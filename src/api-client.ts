/**
 * BinaryLane API Client
 * Handles all HTTP communication with the BinaryLane API
 */

const BASE_URL = 'https://api.binarylane.com.au/v2';

/**
 * ApiError class for better error handling with status code preservation
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * API error response format from BinaryLane
 */
export interface ApiErrorResponse {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface LinksResponse {
  pages?: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

export interface MetaResponse {
  total?: number;
}

export interface RetryConfig {
  maxRetries?: number;        // default: 3
  baseDelay?: number;         // default: 1000ms
  maxDelay?: number;          // default: 32000ms
  backoffMultiplier?: number; // default: 2
}

export interface RateLimitConfig {
  maxConcurrent?: number;     // default: 5
  retryConfig?: RetryConfig;
}

export class BinaryLaneClient {
  private apiToken: string;
  private maxConcurrent: number;
  private retryConfig: Required<RetryConfig>;
  private activeRequests: number = 0;
  private requestQueue: Array<() => void> = [];

  constructor(apiToken: string, config?: RateLimitConfig) {
    this.apiToken = apiToken;
    this.maxConcurrent = config?.maxConcurrent ?? 5;
    this.retryConfig = {
      maxRetries: config?.retryConfig?.maxRetries ?? 3,
      baseDelay: config?.retryConfig?.baseDelay ?? 1000,
      maxDelay: config?.retryConfig?.maxDelay ?? 32000,
      backoffMultiplier: config?.retryConfig?.backoffMultiplier ?? 2,
    };
  }

  private async waitForSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrent) {
      this.activeRequests++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.requestQueue.push(() => {
        this.activeRequests++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeRequests--;
    const next = this.requestQueue.shift();
    if (next) {
      next();
    }
  }

  private shouldRetry(statusCode: number): boolean {
    // Retry on rate limit and server errors
    return statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 504;
  }

  private calculateDelay(attempt: number, retryAfter?: number): number {
    if (retryAfter !== undefined) {
      return retryAfter * 1000; // Convert to milliseconds
    }

    const { baseDelay, backoffMultiplier, maxDelay } = this.retryConfig;
    const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    // Add jitter (±20%)
    const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.max(0, cappedDelay + jitter);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    await this.waitForSlot();

    try {
      let url = `${BASE_URL}${path}`;

      if (queryParams) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(queryParams)) {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
        const queryString = params.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      };

      const options: RequestInit = {
        method,
        headers,
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
        options.body = JSON.stringify(body);
      }

      let lastError: ApiError | Error | undefined;

      for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
        try {
          const response = await fetch(url, options);

          if (response.status === 204) {
            return {} as T;
          }

          const text = await response.text();
          if (!text) {
            console.warn(`Empty response body for ${method} ${path} (status ${response.status})`);
            return {} as T;
          }
          const data = JSON.parse(text);

          if (!response.ok) {
            const error = data as ApiErrorResponse;
            const apiError = new ApiError(
              error.detail || error.title || `API error: ${response.status}`,
              response.status,
              error
            );

            // Check if we should retry
            if (attempt < this.retryConfig.maxRetries && this.shouldRetry(response.status)) {
              lastError = apiError;

              // Check for Retry-After header
              const retryAfter = response.headers.get('Retry-After');
              const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
              const delay = this.calculateDelay(attempt, retryAfterSeconds);

              console.warn(
                `Request failed with status ${response.status}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`
              );

              await this.sleep(delay);
              continue;
            }

            throw apiError;
          }

          return data as T;
        } catch (error) {
          // Network errors or fetch failures
          if (error instanceof ApiError) {
            throw error;
          }

          // Retry on network errors
          if (attempt < this.retryConfig.maxRetries) {
            lastError = error as Error;
            const delay = this.calculateDelay(attempt);

            console.warn(
              `Network error, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries}): ${error}`
            );

            await this.sleep(delay);
            continue;
          }

          throw error;
        }
      }

      // Should never reach here, but just in case
      throw lastError || new Error('Request failed after all retry attempts');
    } finally {
      this.releaseSlot();
    }
  }

  // ==================== Account ====================

  /**
   * Retrieves account information for the authenticated user
   * @returns Promise containing the account details including email, verification status, and server limits
   * @throws {ApiError} If the API request fails
   * @example
   * const { account } = await client.getAccount();
   * console.log(account.email);
   */
  async getAccount() {
    return this.request<{ account: Account }>('GET', '/account');
  }

  /**
   * Retrieves the current account balance and month-to-date usage
   * @returns Promise containing balance information including account balance, usage, and remaining balance
   * @throws {ApiError} If the API request fails
   * @example
   * const { balance } = await client.getBalance();
   * console.log(`Current balance: ${balance.account_balance}`);
   */
  async getBalance() {
    return this.request<{ balance: Balance }>('GET', '/customers/my/balance');
  }

  /**
   * Retrieves a paginated list of invoices for the authenticated customer
   * @param params Optional pagination parameters (page, per_page)
   * @returns Promise containing the list of invoices with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { invoices, meta } = await client.getInvoices({ page: 1, per_page: 20 });
   * console.log(`Total invoices: ${meta?.total}`);
   */
  async getInvoices(params?: PaginationParams) {
    return this.request<{ invoices: Invoice[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/customers/my/invoices', undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves a specific invoice by its ID
   * @param invoiceId The unique identifier of the invoice
   * @returns Promise containing the invoice details
   * @throws {ApiError} If the API request fails or invoice is not found
   * @example
   * const { invoice } = await client.getInvoice(12345);
   * console.log(`Invoice amount: ${invoice.amount}`);
   */
  async getInvoice(invoiceId: number) {
    return this.request<{ invoice: Invoice }>('GET', `/customers/my/invoices/${invoiceId}`);
  }

  /**
   * Retrieves all unpaid invoices with failed payment attempts
   * @returns Promise containing the list of unpaid failed invoices
   * @throws {ApiError} If the API request fails
   * @example
   * const { unpaid_failed_invoices } = await client.getUnpaidFailedInvoices();
   * console.log(`Failed invoices: ${unpaid_failed_invoices.length}`);
   */
  async getUnpaidFailedInvoices() {
    return this.request<{ unpaid_failed_invoices: Invoice[] }>('GET', '/customers/my/unpaid-payment-failed-invoices');
  }

  // ==================== Actions ====================

  /**
   * Proceeds or cancels an action that requires user interaction
   * @param actionId The unique identifier of the action
   * @param proceed Whether to proceed with the action (true) or cancel it (false)
   * @returns Promise that resolves when the action decision is processed
   * @throws {ApiError} If the API request fails
   * @example
   * await client.proceedAction(123, true); // Proceed with action
   */
  async proceedAction(actionId: number, proceed: boolean) {
    return this.request<void>('POST', `/actions/${actionId}/proceed`, { proceed });
  }

  // ==================== Servers ====================

  /**
   * Retrieves a paginated list of all servers in the account
   * @param params Optional pagination parameters and hostname filter
   * @returns Promise containing the list of servers with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { servers, meta } = await client.listServers({ page: 1, per_page: 10 });
   * console.log(`Total servers: ${meta?.total}`);
   */
  async listServers(params?: PaginationParams & { hostname?: string }) {
    return this.request<{ servers: Server[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/servers', undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves detailed information about a specific server
   * @param serverId The unique identifier of the server
   * @returns Promise containing the server details
   * @throws {ApiError} If the API request fails or server is not found
   * @example
   * const { server } = await client.getServer(12345);
   * console.log(`Server status: ${server.status}`);
   */
  async getServer(serverId: number) {
    return this.request<{ server: Server }>('GET', `/servers/${serverId}`);
  }

  /**
   * Creates a new server with the specified configuration
   * @param request The server creation request containing size, image, region, and other options
   * @returns Promise containing the newly created server and action link
   * @throws {ApiError} If the API request fails or validation errors occur
   * @example
   * const { server } = await client.createServer({
   *   size: 'std-min',
   *   image: 'ubuntu-22.04',
   *   region: 'syd',
   *   name: 'my-server'
   * });
   */
  async createServer(request: CreateServerRequest) {
    return this.request<{ server: Server; links?: { action?: ActionLink } }>(
      'POST', '/servers', request
    );
  }

  /**
   * Deletes a server permanently
   * @param serverId The unique identifier of the server to delete
   * @param reason Optional reason for deletion (for audit purposes)
   * @returns Promise that resolves when the server is deleted
   * @throws {ApiError} If the API request fails
   * @example
   * await client.deleteServer(12345, 'No longer needed');
   */
  async deleteServer(serverId: number, reason?: string) {
    return this.request<void>('DELETE', `/servers/${serverId}`, undefined, { reason });
  }

  /**
   * Performs an action on a server (e.g., power on, reboot, resize, etc.)
   * @param serverId The unique identifier of the server
   * @param action The action to perform (see ServerAction type for all options)
   * @returns Promise containing the action details for tracking
   * @throws {ApiError} If the API request fails
   * @example
   * const { action } = await client.performServerAction(12345, { type: 'reboot' });
   * console.log(`Action ID: ${action.id}`);
   */
  async performServerAction(serverId: number, action: ServerAction) {
    return this.request<{ action: Action }>('POST', `/servers/${serverId}/actions`, action);
  }

  /**
   * Retrieves a paginated list of all actions performed on a specific server
   * @param serverId The unique identifier of the server
   * @param params Optional pagination parameters
   * @returns Promise containing the list of actions with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { actions } = await client.listServerActions(12345, { page: 1, per_page: 20 });
   */
  async listServerActions(serverId: number, params?: PaginationParams) {
    return this.request<{ actions: Action[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/servers/${serverId}/actions`, undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves details about a specific action on a server
   * @param serverId The unique identifier of the server
   * @param actionId The unique identifier of the action
   * @returns Promise containing the action details
   * @throws {ApiError} If the API request fails or action is not found
   * @example
   * const { action } = await client.getServerAction(12345, 67890);
   * console.log(`Action status: ${action.status}`);
   */
  async getServerAction(serverId: number, actionId: number) {
    return this.request<{ action: Action }>('GET', `/servers/${serverId}/actions/${actionId}`);
  }

  /**
   * Retrieves a paginated list of backups for a specific server
   * @param serverId The unique identifier of the server
   * @param params Optional pagination parameters
   * @returns Promise containing the list of backups with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { backups } = await client.getServerBackups(12345);
   * console.log(`Available backups: ${backups.length}`);
   */
  async getServerBackups(serverId: number, params?: PaginationParams) {
    return this.request<{ backups: Backup[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/servers/${serverId}/backups`, undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves the advanced firewall rules configured for a specific server
   * @param serverId The unique identifier of the server
   * @returns Promise containing the list of firewall rules
   * @throws {ApiError} If the API request fails
   * @example
   * const { firewall_rules } = await client.getServerFirewallRules(12345);
   */
  async getServerFirewallRules(serverId: number) {
    return this.request<{ firewall_rules: AdvancedFirewallRule[] }>(
      'GET', `/servers/${serverId}/advanced_firewall_rules`
    );
  }

  /**
   * Retrieves console access information for a specific server
   * @param serverId The unique identifier of the server
   * @returns Promise containing VNC console URLs
   * @throws {ApiError} If the API request fails
   * @example
   * const { console } = await client.getServerConsole(12345);
   * console.log(`Web console: ${console.web_vnc_url}`);
   */
  async getServerConsole(serverId: number) {
    return this.request<{ console: ConsoleInfo }>('GET', `/servers/${serverId}/console`);
  }

  /**
   * Retrieves current data transfer usage for a specific server
   * @param serverId The unique identifier of the server
   * @returns Promise containing current data usage information
   * @throws {ApiError} If the API request fails
   * @example
   * const { data_usage } = await client.getCurrentDataUsage(12345);
   * console.log(`Used: ${data_usage.current_transfer_usage_gigabytes}GB`);
   */
  async getCurrentDataUsage(serverId: number) {
    return this.request<{ data_usage: DataUsage }>('GET', `/data_usages/${serverId}/current`);
  }

  /**
   * Retrieves current data usage for all servers in the account
   * @param params Optional pagination parameters
   * @returns Promise containing the list of data usage for all servers
   * @throws {ApiError} If the API request fails
   * @example
   * const { data_usages } = await client.listAllDataUsage({ per_page: 50 });
   */
  async listAllDataUsage(params?: PaginationParams) {
    return this.request<{ data_usages: DataUsage[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/data_usages/current', undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves available kernels for a specific server
   * @param serverId The unique identifier of the server
   * @param params Optional pagination parameters
   * @returns Promise containing the list of available kernels
   * @throws {ApiError} If the API request fails
   * @example
   * const { kernels } = await client.getServerKernels(12345);
   */
  async getServerKernels(serverId: number, params?: PaginationParams) {
    return this.request<{ kernels: Kernel[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/servers/${serverId}/kernels`, undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves available advanced features for a specific server
   * @param serverId The unique identifier of the server
   * @returns Promise containing the list of available advanced server features
   * @throws {ApiError} If the API request fails
   * @example
   * const { available_advanced_server_features } = await client.getServerAvailableFeatures(12345);
   */
  async getServerAvailableFeatures(serverId: number) {
    return this.request<{ available_advanced_server_features: AdvancedServerFeature[] }>(
      'GET', `/servers/${serverId}/available_advanced_features`
    );
  }

  /**
   * Retrieves threshold alert configuration for a specific server
   * @param serverId The unique identifier of the server
   * @returns Promise containing the list of configured threshold alerts
   * @throws {ApiError} If the API request fails
   * @example
   * const { threshold_alerts } = await client.getServerThresholdAlerts(12345);
   */
  async getServerThresholdAlerts(serverId: number) {
    return this.request<{ threshold_alerts: ThresholdAlert[] }>('GET', `/servers/${serverId}/threshold_alerts`);
  }

  /**
   * Retrieves all servers that have currently exceeded their threshold alerts
   * @returns Promise containing the list of servers with exceeded alerts
   * @throws {ApiError} If the API request fails
   * @example
   * const { current_server_alerts } = await client.listExceededThresholdAlerts();
   * console.log(`Servers with alerts: ${current_server_alerts.length}`);
   */
  async listExceededThresholdAlerts() {
    return this.request<{ current_server_alerts: CurrentServerAlert[] }>('GET', '/servers/threshold_alerts');
  }

  /**
   * Retrieves licensed software installed on a specific server
   * @param serverId The unique identifier of the server
   * @param params Optional pagination parameters
   * @returns Promise containing the list of licensed software
   * @throws {ApiError} If the API request fails
   * @example
   * const { software } = await client.getServerSoftware(12345);
   */
  async getServerSoftware(serverId: number, params?: PaginationParams) {
    return this.request<{ software: LicensedSoftware[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/servers/${serverId}/software`, undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves the cloud-init user data for a specific server
   * @param serverId The unique identifier of the server
   * @returns Promise containing the user data string
   * @throws {ApiError} If the API request fails
   * @example
   * const { user_data } = await client.getServerUserData(12345);
   */
  async getServerUserData(serverId: number) {
    return this.request<{ user_data: string }>('GET', `/servers/${serverId}/user_data`);
  }

  /**
   * Uploads a backup image from a URL to a server
   * @param serverId The unique identifier of the server
   * @param request The upload request containing the URL and optional label
   * @returns Promise containing the action details for tracking the upload
   * @throws {ApiError} If the API request fails
   * @example
   * const { action } = await client.uploadBackup(12345, {
   *   url: 'https://example.com/backup.img',
   *   label: 'My Backup'
   * });
   */
  async uploadBackup(serverId: number, request: UploadImageRequest) {
    return this.request<{ action: Action }>('POST', `/servers/${serverId}/backups`, request);
  }

  /**
   * Retrieves a paginated list of snapshots for a specific server
   * @param serverId The unique identifier of the server
   * @param params Optional pagination parameters
   * @returns Promise containing the list of snapshots with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { snapshots } = await client.getServerSnapshots(12345);
   */
  async getServerSnapshots(serverId: number, params?: PaginationParams) {
    return this.request<{ snapshots: Backup[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/servers/${serverId}/snapshots`, undefined, params as Record<string, string | number>
    );
  }

  /**
   * Updates the reverse DNS name for an IPv6 address on a server
   * @param serverId The unique identifier of the server
   * @param ipAddress The IPv6 address to update
   * @param reverseName The reverse DNS name to set
   * @returns Promise that resolves when the reverse DNS is updated
   * @throws {ApiError} If the API request fails
   * @example
   * await client.updateIpv6Reverse(12345, '2001:db8::1', 'server.example.com');
   */
  async updateIpv6Reverse(serverId: number, ipAddress: string, reverseName: string) {
    return this.request<void>('PUT', '/reverse_names/ipv6', {
      server_id: serverId,
      ip_address: ipAddress,
      reverse_name: reverseName,
    });
  }

  // ==================== Sample Sets (Metrics) ====================

  /**
   * Retrieves historical performance metrics for a specific server
   * @param serverId The unique identifier of the server
   * @param params Optional parameters for filtering metrics by time range and interval
   * @returns Promise containing the list of sample sets with metrics data
   * @throws {ApiError} If the API request fails
   * @example
   * const { sample_sets } = await client.getServerMetrics(12345, {
   *   data_interval: '1h',
   *   start: '2024-01-01T00:00:00Z',
   *   end: '2024-01-02T00:00:00Z'
   * });
   */
  async getServerMetrics(serverId: number, params?: {
    data_interval?: string;
    start?: string;
    end?: string;
    page?: number;
    per_page?: number;
  }) {
    return this.request<{ sample_sets: SampleSet[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/samplesets/${serverId}`, undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves the most recent performance metrics for a specific server
   * @param serverId The unique identifier of the server
   * @returns Promise containing the latest sample set with CPU, memory, disk, and network metrics
   * @throws {ApiError} If the API request fails
   * @example
   * const { sample_set } = await client.getServerLatestMetrics(12345);
   * console.log(`CPU usage: ${sample_set.average?.cpu}%`);
   */
  async getServerLatestMetrics(serverId: number) {
    return this.request<{ sample_set: SampleSet }>('GET', `/samplesets/${serverId}/latest`);
  }

  // ==================== Images ====================

  /**
   * Retrieves a paginated list of available images (distributions, backups, snapshots)
   * @param params Optional pagination parameters and type filter (e.g., 'distribution', 'backup', 'snapshot')
   * @returns Promise containing the list of images with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { images } = await client.listImages({ type: 'distribution', per_page: 50 });
   */
  async listImages(params?: PaginationParams & { type?: string }) {
    return this.request<{ images: Image[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/images', undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves detailed information about a specific image
   * @param imageIdOrSlug The unique identifier or slug of the image
   * @returns Promise containing the image details
   * @throws {ApiError} If the API request fails or image is not found
   * @example
   * const { image } = await client.getImage('ubuntu-22.04');
   * console.log(`Image name: ${image.name}`);
   */
  async getImage(imageIdOrSlug: number | string) {
    return this.request<{ image: Image }>('GET', `/images/${imageIdOrSlug}`);
  }

  /**
   * Deletes a custom image (backup or snapshot)
   * @param imageId The unique identifier of the image to delete
   * @returns Promise that resolves when the image is deleted
   * @throws {ApiError} If the API request fails
   * @example
   * await client.deleteImage(12345);
   */
  async deleteImage(imageId: number) {
    return this.request<void>('DELETE', `/images/${imageId}`);
  }

  /**
   * Updates the name or description of a custom image
   * @param imageId The unique identifier of the image
   * @param request The update request containing the new name and/or description
   * @returns Promise containing the updated image
   * @throws {ApiError} If the API request fails
   * @example
   * const { image } = await client.updateImage(12345, {
   *   name: 'My Updated Backup',
   *   description: 'Production backup from 2024-01-15'
   * });
   */
  async updateImage(imageId: number, request: UpdateImageRequest) {
    return this.request<{ image: Image }>('PUT', `/images/${imageId}`, request);
  }

  /**
   * Retrieves a download URL for a custom image
   * @param imageId The unique identifier of the image
   * @returns Promise containing the download link
   * @throws {ApiError} If the API request fails
   * @example
   * const { links } = await client.getImageDownload(12345);
   * console.log(`Download URL: ${links.download}`);
   */
  async getImageDownload(imageId: number) {
    return this.request<{ links: { download: string } }>('GET', `/images/${imageId}/download`);
  }

  // ==================== SSH Keys ====================

  /**
   * Retrieves a paginated list of SSH keys registered to the account
   * @param params Optional pagination parameters
   * @returns Promise containing the list of SSH keys with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { ssh_keys } = await client.listSshKeys({ per_page: 20 });
   */
  async listSshKeys(params?: PaginationParams) {
    return this.request<{ ssh_keys: SshKey[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/account/keys', undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves details about a specific SSH key
   * @param keyId The unique identifier of the SSH key
   * @returns Promise containing the SSH key details
   * @throws {ApiError} If the API request fails or key is not found
   * @example
   * const { ssh_key } = await client.getSshKey(12345);
   * console.log(`Key name: ${ssh_key.name}`);
   */
  async getSshKey(keyId: number) {
    return this.request<{ ssh_key: SshKey }>('GET', `/account/keys/${keyId}`);
  }

  /**
   * Registers a new SSH public key to the account
   * @param request The SSH key creation request containing the public key and name
   * @returns Promise containing the newly created SSH key
   * @throws {ApiError} If the API request fails or the key is invalid
   * @example
   * const { ssh_key } = await client.createSshKey({
   *   public_key: 'ssh-rsa AAAAB3NzaC1...',
   *   name: 'My Laptop Key',
   *   default: true
   * });
   */
  async createSshKey(request: CreateSshKeyRequest) {
    return this.request<{ ssh_key: SshKey }>('POST', '/account/keys', request);
  }

  /**
   * Updates an existing SSH key's name or default status
   * @param keyId The unique identifier of the SSH key
   * @param request The update request containing the new name and/or default status
   * @returns Promise containing the updated SSH key
   * @throws {ApiError} If the API request fails
   * @example
   * const { ssh_key } = await client.updateSshKey(12345, { name: 'Work Laptop' });
   */
  async updateSshKey(keyId: number, request: UpdateSshKeyRequest) {
    return this.request<{ ssh_key: SshKey }>('PUT', `/account/keys/${keyId}`, request);
  }

  /**
   * Deletes an SSH key from the account
   * @param keyId The unique identifier of the SSH key to delete
   * @returns Promise that resolves when the key is deleted
   * @throws {ApiError} If the API request fails
   * @example
   * await client.deleteSshKey(12345);
   */
  async deleteSshKey(keyId: number) {
    return this.request<void>('DELETE', `/account/keys/${keyId}`);
  }

  // ==================== Domains ====================

  /**
   * Retrieves a paginated list of domains managed in the account
   * @param params Optional pagination parameters
   * @returns Promise containing the list of domains with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { domains } = await client.listDomains({ per_page: 20 });
   */
  async listDomains(params?: PaginationParams) {
    return this.request<{ domains: Domain[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/domains', undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves detailed information about a specific domain
   * @param domainName The domain name or ID
   * @returns Promise containing the domain details including nameservers
   * @throws {ApiError} If the API request fails or domain is not found
   * @example
   * const { domain } = await client.getDomain('example.com');
   * console.log(`Nameservers: ${domain.current_nameservers?.join(', ')}`);
   */
  async getDomain(domainName: string | number) {
    return this.request<{ domain: Domain }>('GET', `/domains/${domainName}`);
  }

  /**
   * Registers a new domain to be managed by BinaryLane DNS
   * @param request The domain creation request containing the domain name and optional IP address
   * @returns Promise containing the newly created domain
   * @throws {ApiError} If the API request fails or domain already exists
   * @example
   * const { domain } = await client.createDomain({
   *   name: 'example.com',
   *   ip_address: '203.0.113.10'
   * });
   */
  async createDomain(request: CreateDomainRequest) {
    return this.request<{ domain: Domain }>('POST', '/domains', request);
  }

  /**
   * Deletes a domain from BinaryLane DNS management
   * @param domainName The domain name or ID to delete
   * @returns Promise that resolves when the domain is deleted
   * @throws {ApiError} If the API request fails
   * @example
   * await client.deleteDomain('example.com');
   */
  async deleteDomain(domainName: string | number) {
    return this.request<void>('DELETE', `/domains/${domainName}`);
  }

  /**
   * Retrieves a paginated list of DNS records for a specific domain
   * @param domainName The domain name or ID
   * @param params Optional pagination parameters
   * @returns Promise containing the list of domain records with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { domain_records } = await client.listDomainRecords('example.com');
   */
  async listDomainRecords(domainName: string | number, params?: PaginationParams) {
    return this.request<{ domain_records: DomainRecord[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/domains/${domainName}/records`, undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves details about a specific DNS record
   * @param domainName The domain name or ID
   * @param recordId The unique identifier of the DNS record
   * @returns Promise containing the domain record details
   * @throws {ApiError} If the API request fails or record is not found
   * @example
   * const { domain_record } = await client.getDomainRecord('example.com', 12345);
   */
  async getDomainRecord(domainName: string | number, recordId: number) {
    return this.request<{ domain_record: DomainRecord }>(
      'GET', `/domains/${domainName}/records/${recordId}`
    );
  }

  /**
   * Creates a new DNS record for a domain
   * @param domainName The domain name or ID
   * @param request The DNS record creation request
   * @returns Promise containing the newly created domain record
   * @throws {ApiError} If the API request fails or validation errors occur
   * @example
   * const { domain_record } = await client.createDomainRecord('example.com', {
   *   type: 'A',
   *   name: 'www',
   *   data: '203.0.113.10',
   *   ttl: 3600
   * });
   */
  async createDomainRecord(domainName: string | number, request: CreateDomainRecordRequest) {
    return this.request<{ domain_record: DomainRecord }>(
      'POST', `/domains/${domainName}/records`, request
    );
  }

  /**
   * Updates an existing DNS record
   * @param domainName The domain name or ID
   * @param recordId The unique identifier of the DNS record
   * @param request The DNS record update request
   * @returns Promise containing the updated domain record
   * @throws {ApiError} If the API request fails
   * @example
   * const { domain_record } = await client.updateDomainRecord('example.com', 12345, {
   *   data: '203.0.113.20',
   *   ttl: 7200
   * });
   */
  async updateDomainRecord(domainName: string | number, recordId: number, request: UpdateDomainRecordRequest) {
    return this.request<{ domain_record: DomainRecord }>(
      'PUT', `/domains/${domainName}/records/${recordId}`, request
    );
  }

  /**
   * Deletes a DNS record from a domain
   * @param domainName The domain name or ID
   * @param recordId The unique identifier of the DNS record to delete
   * @returns Promise that resolves when the record is deleted
   * @throws {ApiError} If the API request fails
   * @example
   * await client.deleteDomainRecord('example.com', 12345);
   */
  async deleteDomainRecord(domainName: string | number, recordId: number) {
    return this.request<void>('DELETE', `/domains/${domainName}/records/${recordId}`);
  }

  /**
   * Retrieves the list of BinaryLane nameservers
   * @returns Promise containing the list of nameservers with their IP addresses
   * @throws {ApiError} If the API request fails
   * @example
   * const { nameservers } = await client.listNameservers();
   * nameservers.forEach(ns => console.log(`${ns.name}: ${ns.ip_addresses.join(', ')}`));
   */
  async listNameservers() {
    return this.request<{ nameservers: Nameserver[] }>('GET', '/domains/nameservers');
  }

  /**
   * Refreshes the nameserver cache for a specific domain
   * @param domainName The domain name to refresh
   * @returns Promise that resolves when the cache is refreshed
   * @throws {ApiError} If the API request fails
   * @example
   * await client.refreshNameserverCache('example.com');
   */
  async refreshNameserverCache(domainName: string) {
    return this.request<void>('POST', '/domains/refresh_nameserver_cache', { domain_name: domainName });
  }

  // ==================== Reverse Names ====================

  /**
   * Retrieves a paginated list of IPv6 reverse DNS entries
   * @param params Optional pagination parameters
   * @returns Promise containing the list of IPv6 reverse DNS entries
   * @throws {ApiError} If the API request fails
   * @example
   * const { reverse_names } = await client.listIpv6ReverseName();
   */
  async listIpv6ReverseName(params?: PaginationParams) {
    return this.request<{ reverse_names: ReverseName[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/reverse_names/ipv6', undefined, params as Record<string, string | number>
    );
  }

  // ==================== VPCs ====================

  /**
   * Retrieves a paginated list of Virtual Private Clouds (VPCs)
   * @param params Optional pagination parameters
   * @returns Promise containing the list of VPCs with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { vpcs } = await client.listVpcs({ per_page: 20 });
   */
  async listVpcs(params?: PaginationParams) {
    return this.request<{ vpcs: Vpc[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/vpcs', undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves detailed information about a specific VPC
   * @param vpcId The unique identifier of the VPC
   * @returns Promise containing the VPC details including IP range and route entries
   * @throws {ApiError} If the API request fails or VPC is not found
   * @example
   * const { vpc } = await client.getVpc(12345);
   * console.log(`VPC IP range: ${vpc.ip_range}`);
   */
  async getVpc(vpcId: number) {
    return this.request<{ vpc: Vpc }>('GET', `/vpcs/${vpcId}`);
  }

  /**
   * Creates a new Virtual Private Cloud (VPC)
   * @param request The VPC creation request containing name and optional IP range
   * @returns Promise containing the newly created VPC
   * @throws {ApiError} If the API request fails or validation errors occur
   * @example
   * const { vpc } = await client.createVpc({
   *   name: 'production-vpc',
   *   ip_range: '10.0.0.0/16'
   * });
   */
  async createVpc(request: CreateVpcRequest) {
    return this.request<{ vpc: Vpc }>('POST', '/vpcs', request);
  }

  /**
   * Updates an existing VPC's name or route entries
   * @param vpcId The unique identifier of the VPC
   * @param request The VPC update request containing the new name and/or route entries
   * @returns Promise containing the updated VPC
   * @throws {ApiError} If the API request fails
   * @example
   * const { vpc } = await client.updateVpc(12345, { name: 'staging-vpc' });
   */
  async updateVpc(vpcId: number, request: UpdateVpcRequest) {
    return this.request<{ vpc: Vpc }>('PATCH', `/vpcs/${vpcId}`, request);
  }

  /**
   * Deletes a Virtual Private Cloud (VPC)
   * @param vpcId The unique identifier of the VPC to delete
   * @returns Promise that resolves when the VPC is deleted
   * @throws {ApiError} If the API request fails
   * @example
   * await client.deleteVpc(12345);
   */
  async deleteVpc(vpcId: number) {
    return this.request<void>('DELETE', `/vpcs/${vpcId}`);
  }

  /**
   * Retrieves a paginated list of resources that are members of a VPC
   * @param vpcId The unique identifier of the VPC
   * @param params Optional pagination parameters and resource type filter
   * @returns Promise containing the list of VPC members with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { members } = await client.getVpcMembers(12345, { resource_type: 'server' });
   */
  async getVpcMembers(vpcId: number, params?: PaginationParams & { resource_type?: string }) {
    return this.request<{ members: VpcMember[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/vpcs/${vpcId}/members`, undefined, params as Record<string, string | number>
    );
  }

  // ==================== Load Balancers ====================

  /**
   * Retrieves a paginated list of load balancers
   * @param params Optional pagination parameters
   * @returns Promise containing the list of load balancers with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { load_balancers } = await client.listLoadBalancers({ per_page: 20 });
   */
  async listLoadBalancers(params?: PaginationParams) {
    return this.request<{ load_balancers: LoadBalancer[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/load_balancers', undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves detailed information about a specific load balancer
   * @param loadBalancerId The unique identifier of the load balancer
   * @returns Promise containing the load balancer details
   * @throws {ApiError} If the API request fails or load balancer is not found
   * @example
   * const { load_balancer } = await client.getLoadBalancer(12345);
   * console.log(`Load balancer IP: ${load_balancer.ip}`);
   */
  async getLoadBalancer(loadBalancerId: number) {
    return this.request<{ load_balancer: LoadBalancer }>('GET', `/load_balancers/${loadBalancerId}`);
  }

  /**
   * Creates a new load balancer with the specified configuration
   * @param request The load balancer creation request containing forwarding rules, health checks, and server IDs
   * @returns Promise containing the newly created load balancer
   * @throws {ApiError} If the API request fails or validation errors occur
   * @example
   * const { load_balancer } = await client.createLoadBalancer({
   *   name: 'my-lb',
   *   forwarding_rules: [{ entry_protocol: 'http', entry_port: 80, target_protocol: 'http', target_port: 80 }],
   *   server_ids: [1, 2, 3]
   * });
   */
  async createLoadBalancer(request: CreateLoadBalancerRequest) {
    return this.request<{ load_balancer: LoadBalancer }>('POST', '/load_balancers', request);
  }

  /**
   * Updates an existing load balancer's configuration
   * @param loadBalancerId The unique identifier of the load balancer
   * @param request The update request containing the new configuration
   * @returns Promise containing the updated load balancer
   * @throws {ApiError} If the API request fails
   * @example
   * const { load_balancer } = await client.updateLoadBalancer(12345, {
   *   name: 'updated-lb',
   *   algorithm: 'round_robin'
   * });
   */
  async updateLoadBalancer(loadBalancerId: number, request: UpdateLoadBalancerRequest) {
    return this.request<{ load_balancer: LoadBalancer }>('PUT', `/load_balancers/${loadBalancerId}`, request);
  }

  /**
   * Deletes a load balancer
   * @param loadBalancerId The unique identifier of the load balancer to delete
   * @returns Promise that resolves when the load balancer is deleted
   * @throws {ApiError} If the API request fails
   * @example
   * await client.deleteLoadBalancer(12345);
   */
  async deleteLoadBalancer(loadBalancerId: number) {
    return this.request<void>('DELETE', `/load_balancers/${loadBalancerId}`);
  }

  /**
   * Retrieves load balancer availability and pricing information for a region
   * @param region The region slug to check availability
   * @returns Promise containing the list of available load balancer sizes and pricing
   * @throws {ApiError} If the API request fails
   * @example
   * const { load_balancer_availability } = await client.getLoadBalancerAvailability('syd');
   */
  async getLoadBalancerAvailability(region: string) {
    return this.request<{ load_balancer_availability: LoadBalancerAvailability[] }>(
      'GET', '/load_balancers/availability', undefined, { region }
    );
  }

  /**
   * Adds servers to a load balancer's pool
   * @param loadBalancerId The unique identifier of the load balancer
   * @param serverIds Array of server IDs to add to the load balancer
   * @returns Promise that resolves when the servers are added
   * @throws {ApiError} If the API request fails
   * @example
   * await client.addServersToLoadBalancer(12345, [1, 2, 3]);
   */
  async addServersToLoadBalancer(loadBalancerId: number, serverIds: number[]) {
    return this.request<void>('POST', `/load_balancers/${loadBalancerId}/servers`, { server_ids: serverIds });
  }

  /**
   * Removes servers from a load balancer's pool
   * @param loadBalancerId The unique identifier of the load balancer
   * @param serverIds Array of server IDs to remove from the load balancer
   * @returns Promise that resolves when the servers are removed
   * @throws {ApiError} If the API request fails
   * @example
   * await client.removeServersFromLoadBalancer(12345, [1, 2]);
   */
  async removeServersFromLoadBalancer(loadBalancerId: number, serverIds: number[]) {
    return this.request<void>('DELETE', `/load_balancers/${loadBalancerId}/servers`, { server_ids: serverIds });
  }

  /**
   * Adds forwarding rules to a load balancer
   * @param loadBalancerId The unique identifier of the load balancer
   * @param forwardingRules Array of forwarding rules to add
   * @returns Promise that resolves when the forwarding rules are added
   * @throws {ApiError} If the API request fails
   * @example
   * await client.addForwardingRulesToLoadBalancer(12345, [
   *   { entry_protocol: 'https', entry_port: 443, target_protocol: 'http', target_port: 80 }
   * ]);
   */
  async addForwardingRulesToLoadBalancer(loadBalancerId: number, forwardingRules: ForwardingRule[]) {
    return this.request<void>('POST', `/load_balancers/${loadBalancerId}/forwarding_rules`, { forwarding_rules: forwardingRules });
  }

  /**
   * Removes forwarding rules from a load balancer
   * @param loadBalancerId The unique identifier of the load balancer
   * @param forwardingRules Array of forwarding rules to remove
   * @returns Promise that resolves when the forwarding rules are removed
   * @throws {ApiError} If the API request fails
   * @example
   * await client.removeForwardingRulesFromLoadBalancer(12345, [
   *   { entry_protocol: 'http', entry_port: 8080, target_protocol: 'http', target_port: 80 }
   * ]);
   */
  async removeForwardingRulesFromLoadBalancer(loadBalancerId: number, forwardingRules: ForwardingRule[]) {
    return this.request<void>('DELETE', `/load_balancers/${loadBalancerId}/forwarding_rules`, { forwarding_rules: forwardingRules });
  }

  // ==================== Regions & Sizes ====================

  /**
   * Retrieves a list of all available regions
   * @returns Promise containing the list of regions with their features and availability
   * @throws {ApiError} If the API request fails
   * @example
   * const { regions } = await client.listRegions();
   * regions.forEach(r => console.log(`${r.name} (${r.slug}): ${r.available ? 'Available' : 'Unavailable'}`));
   */
  async listRegions() {
    return this.request<{ regions: Region[] }>('GET', '/regions');
  }

  /**
   * Retrieves a list of available server sizes (plans)
   * @param params Optional parameters to filter sizes by server ID or image
   * @returns Promise containing the list of available sizes with pricing and specifications
   * @throws {ApiError} If the API request fails
   * @example
   * const { sizes } = await client.listSizes({ image: 'ubuntu-22.04' });
   * sizes.forEach(s => console.log(`${s.slug}: $${s.price_monthly}/month`));
   */
  async listSizes(params?: { server_id?: number; image?: string | number }) {
    return this.request<{ sizes: Size[] }>(
      'GET', '/sizes', undefined, params as Record<string, string | number>
    );
  }

  // ==================== Actions ====================

  /**
   * Retrieves a paginated list of all actions (global action history)
   * @param params Optional pagination parameters
   * @returns Promise containing the list of actions with pagination metadata
   * @throws {ApiError} If the API request fails
   * @example
   * const { actions, meta } = await client.listActions({ page: 1, per_page: 20 });
   * console.log(`Total actions: ${meta?.total}`);
   */
  async listActions(params?: PaginationParams) {
    return this.request<{ actions: Action[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/actions', undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves details about a specific action
   * @param actionId The unique identifier of the action
   * @returns Promise containing the action details including status and progress
   * @throws {ApiError} If the API request fails or action is not found
   * @example
   * const { action } = await client.getAction(12345);
   * console.log(`Action status: ${action.status}, progress: ${action.progress?.percent_complete}%`);
   */
  async getAction(actionId: number) {
    return this.request<{ action: Action }>('GET', `/actions/${actionId}`);
  }

  // ==================== Software ====================

  /**
   * Retrieves a paginated list of all available licensed software
   * @param params Optional pagination parameters
   * @returns Promise containing the list of software with pricing information
   * @throws {ApiError} If the API request fails
   * @example
   * const { software } = await client.listSoftware({ per_page: 50 });
   */
  async listSoftware(params?: PaginationParams) {
    return this.request<{ software: Software[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/software', undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves a paginated list of software available for a specific operating system
   * @param operatingSystem The operating system slug or identifier
   * @param params Optional pagination parameters
   * @returns Promise containing the list of available software for the OS
   * @throws {ApiError} If the API request fails
   * @example
   * const { software } = await client.listAvailableSoftware('ubuntu-22.04');
   */
  async listAvailableSoftware(operatingSystem: string, params?: PaginationParams) {
    return this.request<{ software: Software[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/software/${operatingSystem}/available`, undefined, params as Record<string, string | number>
    );
  }

  /**
   * Retrieves details about a specific software package
   * @param softwareId The unique identifier of the software
   * @returns Promise containing the software details including pricing and licensing information
   * @throws {ApiError} If the API request fails or software is not found
   * @example
   * const { software } = await client.getSoftware(12345);
   * console.log(`${software.name}: $${software.cost_per_licence_per_month}/license/month`);
   */
  async getSoftware(softwareId: number) {
    return this.request<{ software: Software }>('GET', `/software/${softwareId}`);
  }

  /**
   * Retrieves a paginated list of software available for a specific operating system by OS ID
   * @param operatingSystemId The operating system ID or slug
   * @param params Optional pagination parameters
   * @returns Promise containing the list of software for the operating system
   * @throws {ApiError} If the API request fails
   * @example
   * const { software } = await client.listSoftwareForOS('ubuntu-22.04');
   */
  async listSoftwareForOS(operatingSystemId: string | number, params?: PaginationParams) {
    return this.request<{ software: Software[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/software/operating_system/${operatingSystemId}`, undefined, params as Record<string, string | number>
    );
  }
}

// ==================== Type Definitions ====================

export interface Account {
  email: string;
  email_verified: boolean;
  server_limit: number;
  status: string;
}

export interface Balance {
  account_balance: string;
  month_to_date_usage: string;
  month_to_date_balance: string;
}

export interface Invoice {
  invoice_id: number;
  invoice_number: string;
  amount: string;
  tax_code: string;
  created: string;
  date_due?: string;
  date_overdue?: string;
  paid: boolean;
  refunded: boolean;
  invoice_download_url?: string;
  tax_invoice_download_url?: string;
}

export interface Server {
  id: number;
  name: string;
  memory: number;
  vcpus: number;
  disk: number;
  created_at: string;
  status: string;
  backup_ids: number[];
  features: string[];
  region: Region;
  image: Image;
  size: Size;
  size_slug: string;
  networks: Networks;
  vpc_id?: number;
  next_backup_window?: BackupWindow;
  password_change_supported: boolean;
  selected_size_options?: SizeOptions;
  partner_id?: number;
  failover_ips?: string[];
  host?: Host;
  disks?: Disk[];
  cancelled_at?: string;
}

export interface Region {
  slug: string;
  name: string;
  sizes: string[];
  available: boolean;
  features: string[];
  name_servers?: string[];
}

export interface Image {
  id: number;
  name: string;
  type: string;
  distribution?: string;
  slug?: string;
  public: boolean;
  regions: string[];
  min_disk_size?: number;
  size_gigabytes?: number;
  created_at: string;
  description?: string;
  status: string;
  error_message?: string;
  backup_type?: string;
}

export interface Size {
  slug: string;
  available: boolean;
  regions: string[];
  price_monthly: number;
  price_hourly: number;
  disk: number;
  memory: number;
  transfer: number;
  vcpus: number;
  vcpu_units: string;
  options?: SizeOptions;
  description?: string;
  cpu_description?: string;
  storage_description?: string;
  exceeds_original_regions?: boolean;
}

export interface SizeOptions {
  ipv4_addresses?: number;
  memory?: number;
  disk?: number;
  transfer?: number;
  offsite_backup_copies?: number;
}

export interface Networks {
  v4: NetworkV4[];
  v6: NetworkV6[];
}

export interface NetworkV4 {
  ip_address: string;
  netmask: string;
  gateway: string;
  type: string;
  reverse_name?: string;
}

export interface NetworkV6 {
  ip_address: string;
  netmask: number;
  gateway: string;
  type: string;
  reverse_name?: string;
}

export interface BackupWindow {
  start: string;
  end: string;
}

export interface Host {
  display_name?: string;
}

export interface Disk {
  id: number;
  size_gigabytes: number;
  description?: string;
  primary: boolean;
}

export interface CreateServerRequest {
  size: string;
  image: string | number;
  region: string;
  name?: string;
  backups?: boolean;
  ipv6?: boolean;
  vpc_id?: number;
  ssh_keys?: (number | string)[];
  user_data?: string;
  options?: SizeOptions;
  port_blocking?: boolean;
  password?: string;
}

// Base type for all server actions
interface BaseServerAction {
  type: string;
}

// Simple actions with no parameters
interface SimpleServerAction extends BaseServerAction {
  type: 'power_on' | 'power_off' | 'reboot' | 'shutdown' | 'power_cycle' |
        'ping' | 'uptime' | 'is_running' |
        'password_reset' | 'disable_selinux' |
        'enable_backups' | 'disable_backups' | 'detach_backup' |
        'enable_ipv6' | 'uncancel';
}

// Actions that require an image parameter
interface ImageServerAction extends BaseServerAction {
  type: 'rebuild' | 'restore' | 'attach_backup';
  image: string | number;
}

// Resize action
interface ResizeServerAction extends BaseServerAction {
  type: 'resize';
  size: string;
}

// Rename action
interface RenameServerAction extends BaseServerAction {
  type: 'rename';
  name: string;
}

// Take backup action with optional parameters
interface TakeBackupServerAction extends BaseServerAction {
  type: 'take_backup';
  backup_type?: 'daily' | 'weekly' | 'monthly' | 'temporary';
  replacement_strategy?: 'none' | 'specified' | 'oldest' | 'newest';
  backup_id_to_replace?: number;
  label?: string;
}

// Clone using backup
interface CloneUsingBackupServerAction extends BaseServerAction {
  type: 'clone_using_backup';
  image: string | number;
  target_server_id: number;
}

// Disk operations
interface AddDiskServerAction extends BaseServerAction {
  type: 'add_disk';
  size_gigabytes: number;
}

interface ResizeDiskServerAction extends BaseServerAction {
  type: 'resize_disk';
  disk_id: number;
  size_gigabytes: number;
}

interface DeleteDiskServerAction extends BaseServerAction {
  type: 'delete_disk';
  disk_id: number;
}

// Network: VPC IPv4
interface ChangeVpcIpv4ServerAction extends BaseServerAction {
  type: 'change_vpc_ipv4';
  ipv4_address: string;
}

// Network: Reverse name
interface ChangeReverseNameServerAction extends BaseServerAction {
  type: 'change_reverse_name';
  reverse_name: string;
}

// Toggle actions (enabled/disabled)
interface ToggleServerAction extends BaseServerAction {
  type: 'change_ipv6' | 'change_port_blocking' | 'change_network' |
        'change_source_and_destination_check' | 'change_separate_private_network_interface';
  enabled: boolean;
}

// Advanced features
interface AdvancedFeaturesServerAction extends BaseServerAction {
  type: 'change_advanced_features';
  features: Record<string, boolean>;
}

// Advanced firewall rules
interface AdvancedFirewallServerAction extends BaseServerAction {
  type: 'change_advanced_firewall_rules';
  firewall_rules: AdvancedFirewallRule[];
}

// Threshold alerts
interface ThresholdAlertsServerAction extends BaseServerAction {
  type: 'change_threshold_alerts';
  threshold_alerts: Array<{
    alert_type: string;
    value: number;
    enabled: boolean;
  }>;
}

// Change kernel
interface ChangeKernelServerAction extends BaseServerAction {
  type: 'change_kernel';
  kernel: number;
}

// Change region
interface ChangeRegionServerAction extends BaseServerAction {
  type: 'change_region';
  region: string;
}

// Backup schedule actions (parameters not yet defined in schema)
interface BackupScheduleServerAction extends BaseServerAction {
  type: 'change_backup_schedule' | 'change_offsite_backup_location' | 'change_manage_offsite_backup_copies';
}

// IPv6 reverse nameservers (parameters not yet defined in schema)
interface ChangeIpv6ReverseNameserversServerAction extends BaseServerAction {
  type: 'change_ipv6_reverse_nameservers';
}

// Change partner (parameters not yet defined in schema)
interface ChangePartnerServerAction extends BaseServerAction {
  type: 'change_partner';
}

// Union type of all possible server actions
export type ServerAction =
  | SimpleServerAction
  | ImageServerAction
  | ResizeServerAction
  | RenameServerAction
  | TakeBackupServerAction
  | CloneUsingBackupServerAction
  | AddDiskServerAction
  | ResizeDiskServerAction
  | DeleteDiskServerAction
  | ChangeVpcIpv4ServerAction
  | ChangeReverseNameServerAction
  | ToggleServerAction
  | AdvancedFeaturesServerAction
  | AdvancedFirewallServerAction
  | ThresholdAlertsServerAction
  | ChangeKernelServerAction
  | ChangeRegionServerAction
  | BackupScheduleServerAction
  | ChangeIpv6ReverseNameserversServerAction
  | ChangePartnerServerAction;

export interface Action {
  id: number;
  status: string;
  type: string;
  started_at: string;
  completed_at?: string;
  resource_id?: number;
  resource_type?: string;
  region?: Region;
  region_slug?: string;
  result_data?: string;
  blocking_invoice_id?: number;
  user_interaction_required?: UserInteraction;
  progress?: ActionProgress;
}

export interface UserInteraction {
  interaction_type: string;
}

export interface ActionProgress {
  current_step?: string;
  percent_complete?: number;
}

export interface ActionLink {
  id: number;
  rel: string;
  href: string;
}

export interface Backup {
  id: number;
  server_id: number;
  name?: string;
  slug?: string;
  created_at: string;
  type: string;
  regions: string[];
  min_disk_size: number;
  size_gigabytes: number;
  status: string;
  backup_type?: string;
  description?: string;
  offsite_backup_regions?: OffsiteBackup[];
}

export interface OffsiteBackup {
  region_slug: string;
  destination?: string;
  status?: string;
}

export interface AdvancedFirewallRule {
  source_addresses: string[];
  destination_addresses: string[];
  destination_ports?: string[];
  protocol: string;
  action: string;
  description?: string;
}

export interface ConsoleInfo {
  vnc_url?: string;
  web_vnc_url?: string;
}

export interface DataUsage {
  server_id: number;
  expires: string;
  transfer_gigabytes: number;
  current_transfer_usage_gigabytes: number;
  transfer_period_end: string;
}

export interface SshKey {
  id: number;
  fingerprint: string;
  public_key: string;
  name: string;
  default: boolean;
}

export interface CreateSshKeyRequest {
  public_key: string;
  name: string;
  default?: boolean;
}

export interface UpdateSshKeyRequest {
  name?: string;
  default?: boolean;
}

export interface Domain {
  name: string;
  current_nameservers?: string[];
  zone_file?: string;
}

export interface CreateDomainRequest {
  name: string;
  ip_address?: string;
}

export interface DomainRecord {
  id: number;
  type: string;
  name: string;
  data: string;
  priority?: number;
  port?: number;
  ttl: number;
  weight?: number;
  flags?: number;
  tag?: string;
}

export interface CreateDomainRecordRequest {
  type: string;
  name: string;
  data: string;
  priority?: number;
  port?: number;
  ttl?: number;
  weight?: number;
  flags?: number;
  tag?: string;
}

export interface UpdateDomainRecordRequest {
  type?: string;
  name?: string;
  data?: string;
  priority?: number;
  port?: number;
  ttl?: number;
  weight?: number;
  flags?: number;
  tag?: string;
}

export interface UpdateImageRequest {
  name?: string;
  description?: string;
}

export interface Vpc {
  id: number;
  name: string;
  ip_range: string;
  route_entries: RouteEntry[];
}

export interface RouteEntry {
  router: string;
  destination: string;
  description?: string;
}

export interface CreateVpcRequest {
  name: string;
  ip_range?: string;
}

export interface UpdateVpcRequest {
  name?: string;
  route_entries?: RouteEntry[];
}

export interface VpcMember {
  name: string;
  resource_type: string;
  resource_id: number;
  created_at: string;
}

export interface LoadBalancer {
  id: number;
  name: string;
  ip: string;
  status: string;
  created_at: string;
  region: Region;
  size_slug?: string;
  algorithm?: string;
  forwarding_rules: ForwardingRule[];
  health_check?: HealthCheck;
  sticky_sessions?: StickySession;
  server_ids: number[];
}

export interface ForwardingRule {
  entry_protocol: string;
  entry_port: number;
  target_protocol: string;
  target_port: number;
  certificate_id?: string;
  tls_passthrough?: boolean;
}

export interface HealthCheck {
  protocol: string;
  port: number;
  path?: string;
  hostname?: string;
  check_interval_seconds?: number;
  response_timeout_seconds?: number;
  unhealthy_threshold?: number;
  healthy_threshold?: number;
}

export interface StickySession {
  type?: string;
  cookie_name?: string;
  cookie_ttl_seconds?: number;
}

export interface CreateLoadBalancerRequest {
  name: string;
  // region is intentionally omitted. BinaryLane load balancers are anycast —
  // their location is determined by the servers assigned to them, not by a
  // region parameter. Passing a region causes an IP allocation error.
  forwarding_rules: ForwardingRule[];
  health_check?: HealthCheck;
  sticky_sessions?: StickySession;
  server_ids?: number[];
  algorithm?: string;
  size_slug?: string;
}

export interface UpdateLoadBalancerRequest {
  name?: string;
  forwarding_rules?: ForwardingRule[];
  health_check?: HealthCheck;
  sticky_sessions?: StickySession;
  server_ids?: number[];
  algorithm?: string;
}

export interface Software {
  id: number;
  name: string;
  description?: string;
  cost_per_licence_per_month: number;
  minimum_licence_count: number;
  maximum_licence_count: number;
  licence_step_count: number;
  supported_operating_systems?: string[];
  group?: string;
}

// ==================== Additional Type Definitions ====================

export interface Kernel {
  id: number;
  name: string;
  version: string;
}

export interface AdvancedServerFeature {
  feature: string;
  enabled: boolean;
  description?: string;
}

export interface ThresholdAlert {
  alert_type: string;
  value: number;
  current_value?: number;
  enabled: boolean;
}

export interface CurrentServerAlert {
  server_id: number;
  alert_type: string;
  value: number;
  current_value: number;
}

export interface LicensedSoftware {
  software_id: number;
  name: string;
  licence_count: number;
}

export interface SampleSet {
  period_start: string;
  period_end: string;
  average?: SampleData;
  maximum?: SampleData;
  data?: SampleData[];
}

export interface SampleData {
  cpu: number;
  storage_requests: number;
  network_incoming: number;
  network_outgoing: number;
  disk_read: number;
  disk_write: number;
  memory_used?: number;
  memory_cached?: number;
  timestamp?: string;
}

export interface UploadImageRequest {
  url: string;
  label?: string;
  backup_type?: string;
}

export interface Nameserver {
  name: string;
  ip_addresses: string[];
}

export interface ReverseName {
  ip_address: string;
  reverse_name: string;
  server_id?: number;
}

export interface LoadBalancerAvailability {
  region_slug: string;
  options: LoadBalancerOption[];
}

export interface LoadBalancerOption {
  size_slug: string;
  price_monthly: number;
  price_hourly: number;
}
