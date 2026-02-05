/**
 * BinaryLane API Client
 * Handles all HTTP communication with the BinaryLane API
 */

const BASE_URL = 'https://api.binarylane.com.au/v2';

export interface ApiError {
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

export class BinaryLaneClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    let url = `${BASE_URL}${path}`;

    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
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

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      throw new Error(error.detail || error.title || `API error: ${response.status}`);
    }

    return data as T;
  }

  // ==================== Account ====================

  async getAccount() {
    return this.request<{ account: Account }>('GET', '/account');
  }

  async getBalance() {
    return this.request<{ balance: Balance }>('GET', '/customers/my/balance');
  }

  async getInvoices(params?: PaginationParams) {
    return this.request<{ invoices: Invoice[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/customers/my/invoices', undefined, params as Record<string, string | number>
    );
  }

  async getInvoice(invoiceId: number) {
    return this.request<{ invoice: Invoice }>('GET', `/customers/my/invoices/${invoiceId}`);
  }

  async getUnpaidFailedInvoices() {
    return this.request<{ unpaid_failed_invoices: Invoice[] }>('GET', '/customers/my/unpaid-payment-failed-invoices');
  }

  // ==================== Actions ====================

  async proceedAction(actionId: number, proceed: boolean) {
    return this.request<void>('POST', `/actions/${actionId}/proceed`, { proceed });
  }

  // ==================== Servers ====================

  async listServers(params?: PaginationParams & { hostname?: string }) {
    return this.request<{ servers: Server[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/servers', undefined, params as Record<string, string | number>
    );
  }

  async getServer(serverId: number) {
    return this.request<{ server: Server }>('GET', `/servers/${serverId}`);
  }

  async createServer(request: CreateServerRequest) {
    return this.request<{ server: Server; links?: { action?: ActionLink } }>(
      'POST', '/servers', request
    );
  }

  async deleteServer(serverId: number, reason?: string) {
    return this.request<void>('DELETE', `/servers/${serverId}`, undefined, { reason });
  }

  async performServerAction(serverId: number, action: ServerAction) {
    return this.request<{ action: Action }>('POST', `/servers/${serverId}/actions`, action);
  }

  async listServerActions(serverId: number, params?: PaginationParams) {
    return this.request<{ actions: Action[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/servers/${serverId}/actions`, undefined, params as Record<string, string | number>
    );
  }

  async getServerAction(serverId: number, actionId: number) {
    return this.request<{ action: Action }>('GET', `/servers/${serverId}/actions/${actionId}`);
  }

  async getServerBackups(serverId: number, params?: PaginationParams) {
    return this.request<{ backups: Backup[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/servers/${serverId}/backups`, undefined, params as Record<string, string | number>
    );
  }

  async getServerFirewallRules(serverId: number) {
    return this.request<{ firewall_rules: AdvancedFirewallRule[] }>(
      'GET', `/servers/${serverId}/advanced_firewall_rules`
    );
  }

  async getServerConsole(serverId: number) {
    return this.request<{ console: ConsoleInfo }>('GET', `/servers/${serverId}/console`);
  }

  async getCurrentDataUsage(serverId: number) {
    return this.request<{ data_usage: DataUsage }>('GET', `/data_usages/${serverId}/current`);
  }

  async listAllDataUsage(params?: PaginationParams) {
    return this.request<{ data_usages: DataUsage[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/data_usages/current', undefined, params as Record<string, string | number>
    );
  }

  async getServerKernels(serverId: number, params?: PaginationParams) {
    return this.request<{ kernels: Kernel[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/servers/${serverId}/kernels`, undefined, params as Record<string, string | number>
    );
  }

  async getServerAvailableFeatures(serverId: number) {
    return this.request<{ available_advanced_server_features: AdvancedServerFeature[] }>(
      'GET', `/servers/${serverId}/available_advanced_features`
    );
  }

  async getServerThresholdAlerts(serverId: number) {
    return this.request<{ threshold_alerts: ThresholdAlert[] }>('GET', `/servers/${serverId}/threshold_alerts`);
  }

  async listExceededThresholdAlerts() {
    return this.request<{ current_server_alerts: CurrentServerAlert[] }>('GET', '/servers/threshold_alerts');
  }

  async getServerSoftware(serverId: number, params?: PaginationParams) {
    return this.request<{ software: LicensedSoftware[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/servers/${serverId}/software`, undefined, params as Record<string, string | number>
    );
  }

  async getServerUserData(serverId: number) {
    return this.request<{ user_data: string }>('GET', `/servers/${serverId}/user_data`);
  }

  async uploadBackup(serverId: number, request: UploadImageRequest) {
    return this.request<{ action: Action }>('POST', `/servers/${serverId}/backups`, request);
  }

  async getServerSnapshots(serverId: number, params?: PaginationParams) {
    return this.request<{ snapshots: Backup[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/servers/${serverId}/snapshots`, undefined, params as Record<string, string | number>
    );
  }

  async updateIpv6Reverse(serverId: number, ipAddress: string, reverseName: string) {
    return this.request<void>('PUT', '/reverse_names/ipv6', {
      server_id: serverId,
      ip_address: ipAddress,
      reverse_name: reverseName,
    });
  }

  // ==================== Sample Sets (Metrics) ====================

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

  async getServerLatestMetrics(serverId: number) {
    return this.request<{ sample_set: SampleSet }>('GET', `/samplesets/${serverId}/latest`);
  }

  // ==================== Images ====================

  async listImages(params?: PaginationParams & { type?: string }) {
    return this.request<{ images: Image[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/images', undefined, params as Record<string, string | number>
    );
  }

  async getImage(imageIdOrSlug: number | string) {
    return this.request<{ image: Image }>('GET', `/images/${imageIdOrSlug}`);
  }

  async deleteImage(imageId: number) {
    return this.request<void>('DELETE', `/images/${imageId}`);
  }

  async updateImage(imageId: number, request: UpdateImageRequest) {
    return this.request<{ image: Image }>('PUT', `/images/${imageId}`, request);
  }

  async getImageDownload(imageId: number) {
    return this.request<{ links: { download: string } }>('GET', `/images/${imageId}/download`);
  }

  // ==================== SSH Keys ====================

  async listSshKeys(params?: PaginationParams) {
    return this.request<{ ssh_keys: SshKey[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/account/keys', undefined, params as Record<string, string | number>
    );
  }

  async getSshKey(keyId: number) {
    return this.request<{ ssh_key: SshKey }>('GET', `/account/keys/${keyId}`);
  }

  async createSshKey(request: CreateSshKeyRequest) {
    return this.request<{ ssh_key: SshKey }>('POST', '/account/keys', request);
  }

  async updateSshKey(keyId: number, request: UpdateSshKeyRequest) {
    return this.request<{ ssh_key: SshKey }>('PUT', `/account/keys/${keyId}`, request);
  }

  async deleteSshKey(keyId: number) {
    return this.request<void>('DELETE', `/account/keys/${keyId}`);
  }

  // ==================== Domains ====================

  async listDomains(params?: PaginationParams) {
    return this.request<{ domains: Domain[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/domains', undefined, params as Record<string, string | number>
    );
  }

  async getDomain(domainName: string | number) {
    return this.request<{ domain: Domain }>('GET', `/domains/${domainName}`);
  }

  async createDomain(request: CreateDomainRequest) {
    return this.request<{ domain: Domain }>('POST', '/domains', request);
  }

  async deleteDomain(domainName: string | number) {
    return this.request<void>('DELETE', `/domains/${domainName}`);
  }

  async listDomainRecords(domainName: string | number, params?: PaginationParams) {
    return this.request<{ domain_records: DomainRecord[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/domains/${domainName}/records`, undefined, params as Record<string, string | number>
    );
  }

  async getDomainRecord(domainName: string | number, recordId: number) {
    return this.request<{ domain_record: DomainRecord }>(
      'GET', `/domains/${domainName}/records/${recordId}`
    );
  }

  async createDomainRecord(domainName: string | number, request: CreateDomainRecordRequest) {
    return this.request<{ domain_record: DomainRecord }>(
      'POST', `/domains/${domainName}/records`, request
    );
  }

  async updateDomainRecord(domainName: string | number, recordId: number, request: UpdateDomainRecordRequest) {
    return this.request<{ domain_record: DomainRecord }>(
      'PUT', `/domains/${domainName}/records/${recordId}`, request
    );
  }

  async deleteDomainRecord(domainName: string | number, recordId: number) {
    return this.request<void>('DELETE', `/domains/${domainName}/records/${recordId}`);
  }

  async listNameservers() {
    return this.request<{ nameservers: Nameserver[] }>('GET', '/domains/nameservers');
  }

  async refreshNameserverCache(domainName: string) {
    return this.request<void>('POST', '/domains/refresh_nameserver_cache', { domain_name: domainName });
  }

  // ==================== Reverse Names ====================

  async listIpv6ReverseName(params?: PaginationParams) {
    return this.request<{ reverse_names: ReverseName[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/reverse_names/ipv6', undefined, params as Record<string, string | number>
    );
  }

  // ==================== VPCs ====================

  async listVpcs(params?: PaginationParams) {
    return this.request<{ vpcs: Vpc[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/vpcs', undefined, params as Record<string, string | number>
    );
  }

  async getVpc(vpcId: number) {
    return this.request<{ vpc: Vpc }>('GET', `/vpcs/${vpcId}`);
  }

  async createVpc(request: CreateVpcRequest) {
    return this.request<{ vpc: Vpc }>('POST', '/vpcs', request);
  }

  async updateVpc(vpcId: number, request: UpdateVpcRequest) {
    return this.request<{ vpc: Vpc }>('PATCH', `/vpcs/${vpcId}`, request);
  }

  async deleteVpc(vpcId: number) {
    return this.request<void>('DELETE', `/vpcs/${vpcId}`);
  }

  async getVpcMembers(vpcId: number, params?: PaginationParams & { resource_type?: string }) {
    return this.request<{ members: VpcMember[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/vpcs/${vpcId}/members`, undefined, params as Record<string, string | number>
    );
  }

  // ==================== Load Balancers ====================

  async listLoadBalancers(params?: PaginationParams) {
    return this.request<{ load_balancers: LoadBalancer[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/load_balancers', undefined, params as Record<string, string | number>
    );
  }

  async getLoadBalancer(loadBalancerId: number) {
    return this.request<{ load_balancer: LoadBalancer }>('GET', `/load_balancers/${loadBalancerId}`);
  }

  async createLoadBalancer(request: CreateLoadBalancerRequest) {
    return this.request<{ load_balancer: LoadBalancer }>('POST', '/load_balancers', request);
  }

  async updateLoadBalancer(loadBalancerId: number, request: UpdateLoadBalancerRequest) {
    return this.request<{ load_balancer: LoadBalancer }>('PUT', `/load_balancers/${loadBalancerId}`, request);
  }

  async deleteLoadBalancer(loadBalancerId: number) {
    return this.request<void>('DELETE', `/load_balancers/${loadBalancerId}`);
  }

  async getLoadBalancerAvailability(region: string) {
    return this.request<{ load_balancer_availability: LoadBalancerAvailability[] }>(
      'GET', '/load_balancers/availability', undefined, { region }
    );
  }

  async addServersToLoadBalancer(loadBalancerId: number, serverIds: number[]) {
    return this.request<void>('POST', `/load_balancers/${loadBalancerId}/servers`, { server_ids: serverIds });
  }

  async removeServersFromLoadBalancer(loadBalancerId: number, serverIds: number[]) {
    return this.request<void>('DELETE', `/load_balancers/${loadBalancerId}/servers`, { server_ids: serverIds });
  }

  async addForwardingRulesToLoadBalancer(loadBalancerId: number, forwardingRules: ForwardingRule[]) {
    return this.request<void>('POST', `/load_balancers/${loadBalancerId}/forwarding_rules`, { forwarding_rules: forwardingRules });
  }

  async removeForwardingRulesFromLoadBalancer(loadBalancerId: number, forwardingRules: ForwardingRule[]) {
    return this.request<void>('DELETE', `/load_balancers/${loadBalancerId}/forwarding_rules`, { forwarding_rules: forwardingRules });
  }

  // ==================== Regions & Sizes ====================

  async listRegions() {
    return this.request<{ regions: Region[] }>('GET', '/regions');
  }

  async listSizes(params?: { server_id?: number; image?: string | number }) {
    return this.request<{ sizes: Size[] }>(
      'GET', '/sizes', undefined, params as Record<string, string | number>
    );
  }

  // ==================== Actions ====================

  async listActions(params?: PaginationParams) {
    return this.request<{ actions: Action[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/actions', undefined, params as Record<string, string | number>
    );
  }

  async getAction(actionId: number) {
    return this.request<{ action: Action }>('GET', `/actions/${actionId}`);
  }

  // ==================== Software ====================

  async listSoftware(params?: PaginationParams) {
    return this.request<{ software: Software[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', '/software', undefined, params as Record<string, string | number>
    );
  }

  async listAvailableSoftware(operatingSystem: string, params?: PaginationParams) {
    return this.request<{ software: Software[]; links?: LinksResponse; meta?: MetaResponse }>(
      'GET', `/software/${operatingSystem}/available`, undefined, params as Record<string, string | number>
    );
  }

  async getSoftware(softwareId: number) {
    return this.request<{ software: Software }>('GET', `/software/${softwareId}`);
  }

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

export interface ServerAction {
  type: string;
  [key: string]: unknown;
}

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
  region: string;
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
