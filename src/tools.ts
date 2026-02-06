/**
 * Tool definitions for BinaryLane MCP Server
 * Each tool includes comprehensive descriptions, input schemas, and annotations
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

// Tool annotation interface
interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

// Helper to create tool with annotations
function defineTool(
  name: string,
  description: string,
  inputSchema: object,
  annotations: ToolAnnotations
): Tool {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      ...inputSchema,
    },
    annotations,
  } as Tool;
}

// ==================== Account Tools ====================

export const accountTools: Tool[] = [
  defineTool(
    'get_account',
    `Fetch information about the current BinaryLane account.

Returns:
  - email: Account email address
  - email_verified: Whether email is verified
  - server_limit: Maximum number of servers allowed
  - status: Account status (active, suspended, etc.)

Example usage: Check account status before creating new servers.`,
    { properties: {} },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_balance',
    `Get current account balance and month-to-date usage.

Returns:
  - account_balance: Current account balance (prepaid credit)
  - month_to_date_usage: Total charges this billing period
  - month_to_date_balance: Net balance for this period

Example usage: Monitor spending and check available credit.`,
    { properties: {} },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'list_invoices',
    `List all invoices for the account with pagination.

Returns array of invoices with:
  - invoice_id, invoice_number
  - amount, tax_code
  - created, date_due, date_overdue
  - paid, refunded status
  - download URLs for PDF invoices

Pagination: Use page and per_page to navigate large lists.`,
    {
      properties: {
        page: { type: 'number', description: 'Page number (starts at 1)', default: 1 },
        per_page: { type: 'number', description: 'Results per page (1-200)', default: 20 },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_invoice',
    `Fetch a specific invoice by ID.

Returns detailed invoice information including line items and download URLs.`,
    {
      properties: {
        invoice_id: { type: 'number', description: 'The invoice ID to fetch' },
      },
      required: ['invoice_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_unpaid_invoices',
    `Get unpaid invoices that have failed payment attempts.

Important: Unpaid failed invoices may block:
  - Creating new servers
  - Renewing existing services
  - Adding new services

Check this if operations are failing unexpectedly.`,
    { properties: {} },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'proceed_action',
    `Respond to a UserInteractionRequired action.

Some operations require explicit user confirmation (e.g., destructive changes).
Use this to confirm or cancel such pending actions.

Parameters:
  - action_id: The pending action ID
  - proceed: true to confirm, false to cancel`,
    {
      properties: {
        action_id: { type: 'number', description: 'The action ID to respond to' },
        proceed: { type: 'boolean', description: 'true to confirm, false to cancel' },
      },
      required: ['action_id', 'proceed'],
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  ),
];

// ==================== Server Tools ====================

export const serverTools: Tool[] = [
  defineTool(
    'list_servers',
    `List all VPS servers in the account.

Returns array of servers with:
  - id, name (hostname)
  - status (new, active, off, archive)
  - memory, vcpus, disk specifications
  - region, image, size information
  - networks (public/private IPs)
  - backup_ids, features enabled

Filter by hostname to find specific servers.
Use pagination for accounts with many servers.`,
    {
      properties: {
        hostname: { type: 'string', description: 'Filter by hostname (partial match)' },
        page: { type: 'number', description: 'Page number (starts at 1)' },
        per_page: { type: 'number', description: 'Results per page (1-200)' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server',
    `Get detailed information about a specific server.

Returns complete server details including:
  - Hardware specs (memory, vcpus, disk)
  - Network configuration (IPv4, IPv6, private)
  - Current status and features
  - Backup configuration
  - VPC membership`,
    {
      properties: {
        server_id: { type: 'number', description: 'The server ID' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'create_server',
    `Create a new VPS server.

Required parameters:
  - size: Server size slug (use list_sizes to see options)
  - image: OS image ID or slug (use list_images to see options)
  - region: Data center region (syd, mel, bne, per)

Optional parameters:
  - name: Hostname (auto-generated if not provided)
  - backups: Enable automatic backups
  - ipv6: Enable IPv6
  - vpc_id: Add to VPC for private networking
  - ssh_keys: SSH key IDs for root access
  - user_data: Cloud-init script
  - password: Root password (auto-generated if not provided)

Returns the new server details including the root password if auto-generated.

Example: Create Ubuntu server in Sydney
  size: "std-1vcpu-1gb"
  image: "ubuntu-24.04-x64"
  region: "syd"
  name: "my-web-server"
  backups: true`,
    {
      properties: {
        size: { type: 'string', description: 'Size slug (e.g., "std-min", "std-1vcpu-1gb")' },
        image: { type: 'string', description: 'Image ID or slug (e.g., "ubuntu-24.04-x64")' },
        region: { type: 'string', description: 'Region slug (syd, mel, bne, per)' },
        name: { type: 'string', description: 'Server hostname' },
        backups: { type: 'boolean', description: 'Enable automatic backups' },
        ipv6: { type: 'boolean', description: 'Enable IPv6' },
        vpc_id: { type: 'number', description: 'VPC ID for private networking' },
        ssh_keys: { type: 'array', items: { type: 'number' }, description: 'SSH key IDs' },
        user_data: { type: 'string', description: 'Cloud-init user data script' },
        password: { type: 'string', description: 'Root password' },
        port_blocking: { type: 'boolean', description: 'Enable outbound port blocking' },
      },
      required: ['size', 'image', 'region'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'delete_server',
    `Cancel/delete a server.

WARNING: This will:
  - Stop the server immediately
  - Schedule it for deletion
  - Remove all data after the billing period

The server can be uncancelled before final deletion using the 'uncancel' server action.`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID to delete' },
        reason: { type: 'string', description: 'Cancellation reason (optional)' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'server_action',
    `Perform an action on a server.

Power actions:
  - power_on: Start the server
  - power_off: Force power off (like pulling the plug)
  - shutdown: Graceful shutdown via ACPI
  - reboot: Graceful reboot
  - power_cycle: Hard reboot

Status checks:
  - ping: Check if server responds to ping
  - uptime: Get server uptime
  - is_running: Check if server is running

Backup actions:
  - take_backup: Create manual backup (params: replacement_strategy (required), backup_type, label, backup_id_to_replace)
  - restore: Restore from backup (params: image - backup ID)
  - enable_backups / disable_backups: Toggle automatic backups
  - attach_backup / detach_backup: Mount/unmount backup for file recovery

Configuration:
  - rebuild: Reinstall OS (params: image)
  - resize: Change server size (params: size)
  - rename: Change hostname (params: name)
  - change_region: Migrate to different region (params: region)

Network:
  - enable_ipv6 / change_ipv6: Configure IPv6
  - change_port_blocking: Toggle outbound port blocking
  - change_network / change_vpc_ipv4: Network configuration
  - change_reverse_name: Set reverse DNS

Advanced:
  - change_kernel: Change Linux kernel
  - change_advanced_features: Toggle features
  - change_advanced_firewall_rules: Update firewall (params: firewall_rules - array of rule objects)
    Example firewall_rules to allow SSH, HTTP, HTTPS and ICMP:
      [
        {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "destination_ports": ["22"], "protocol": "tcp", "action": "accept", "description": "Allow SSH"},
        {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "destination_ports": ["80"], "protocol": "tcp", "action": "accept", "description": "Allow HTTP"},
        {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "destination_ports": ["443"], "protocol": "tcp", "action": "accept", "description": "Allow HTTPS"},
        {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "protocol": "icmp", "action": "accept", "description": "Allow ICMP"}
      ]
    Note: destination_ports must be an array of strings, not a single string. Omit destination_ports for ICMP rules. Use IPv4 ("0.0.0.0/0") and IPv6 ("::/0") separately if needed.
  - change_threshold_alerts: Configure resource alerts
  - add_disk / resize_disk / delete_disk: Manage disks
  - uncancel: Revert server cancellation`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
        action_type: {
          type: 'string',
          description: 'Action to perform',
          enum: [
            'power_on', 'power_off', 'reboot', 'shutdown', 'power_cycle',
            'ping', 'uptime', 'is_running',
            'password_reset', 'disable_selinux',
            'take_backup', 'restore', 'enable_backups', 'disable_backups',
            'attach_backup', 'detach_backup', 'clone_using_backup',
            'rebuild', 'resize', 'change_region',
            'add_disk', 'resize_disk', 'delete_disk',
            'enable_ipv6', 'change_ipv6', 'change_port_blocking',
            'change_network', 'change_vpc_ipv4',
            'change_reverse_name', 'change_ipv6_reverse_nameservers',
            'rename', 'uncancel', 'change_kernel',
            'change_advanced_features', 'change_advanced_firewall_rules',
            'change_threshold_alerts',
          ],
        },
        image: { type: 'string', description: 'Image ID/slug for rebuild, restore' },
        size: { type: 'string', description: 'Size slug for resize' },
        name: { type: 'string', description: 'New hostname for rename' },
        backup_type: { type: 'string', description: 'Backup type: daily, weekly, monthly, temporary. Required for take_backup unless replacement_strategy is "specified".' },
        replacement_strategy: { type: 'string', description: 'Strategy for which backup to replace (required for take_backup): none, specified, oldest, newest', enum: ['none', 'specified', 'oldest', 'newest'] },
        backup_id_to_replace: { type: 'number', description: 'Backup ID to replace when replacement_strategy is "specified"' },
        label: { type: 'string', description: 'Label for backup' },
        disk_id: { type: 'number', description: 'Disk ID for disk operations' },
        size_gigabytes: { type: 'number', description: 'Disk size in GB' },
        region: { type: 'string', description: 'Region for change_region' },
        enabled: { type: 'boolean', description: 'Enable/disable flag' },
        kernel_id: { type: 'number', description: 'Kernel ID for change_kernel' },
        firewall_rules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source_addresses: { type: 'array', items: { type: 'string' }, description: 'Source IP addresses/CIDR ranges (e.g. ["0.0.0.0/0"] for all IPv4)' },
              destination_addresses: { type: 'array', items: { type: 'string' }, description: 'Destination IP addresses/CIDR ranges (e.g. ["0.0.0.0/0"] for all IPv4)' },
              destination_ports: { type: 'array', items: { type: 'string' }, description: 'Array of port strings (e.g. ["80", "443", "8000-8100"]). Omit for ICMP rules.' },
              protocol: { type: 'string', enum: ['tcp', 'udp', 'icmp', 'all'], description: 'Protocol (omit destination_ports when using icmp)' },
              action: { type: 'string', enum: ['accept', 'drop'], description: 'Allow or block traffic matching this rule' },
              description: { type: 'string', description: 'Human-readable rule description (max 250 chars)' },
            },
            required: ['source_addresses', 'destination_addresses', 'protocol', 'action'],
          },
          description: 'Firewall rules for change_advanced_firewall_rules action',
        },
      },
      required: ['server_id', 'action_type'],
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'list_server_actions',
    `List all actions performed on a server.

Shows action history including:
  - Action type and status
  - Start and completion times
  - Progress information
  - Any errors or required interactions`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_action',
    `Get details of a specific server action.

Useful for checking the status of long-running operations.`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
        action_id: { type: 'number', description: 'Action ID' },
      },
      required: ['server_id', 'action_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_backups',
    `List all backups for a server.

Returns backup images with:
  - Backup type (daily, weekly, monthly, temporary)
  - Creation date and size
  - Status and availability
  - Offsite backup locations`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_snapshots',
    `List all snapshots for a server.

Snapshots are point-in-time images that can be used to:
  - Restore the server to a previous state
  - Create new servers from the snapshot`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'upload_backup',
    `Upload an external backup image to a server.

The backup must be accessible via a public URL.
Supported formats depend on the server's hypervisor.`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
        url: { type: 'string', description: 'Public URL of the backup image' },
        label: { type: 'string', description: 'Label for the backup' },
        backup_type: { type: 'string', description: 'Backup type classification' },
      },
      required: ['server_id', 'url'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'get_server_firewall',
    `Get advanced firewall rules for a server.

Returns rules with:
  - Source and destination addresses
  - Ports and protocols
  - Allow/deny actions
  - Rule descriptions`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_console',
    `Get VNC console access URLs for a server.

Returns:
  - vnc_url: VNC connection URL
  - web_vnc_url: Browser-based VNC console

Useful for:
  - Troubleshooting boot issues
  - Accessing server when SSH is unavailable
  - Initial OS configuration`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_data_usage',
    `Get current data transfer usage for a server.

Returns:
  - transfer_gigabytes: Monthly allowance
  - current_transfer_usage_gigabytes: Used this period
  - transfer_period_end: When usage resets

Excess transfer is charged per GB.`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'list_all_data_usage',
    `List data transfer usage for all servers.

Useful for monitoring overall bandwidth consumption across your infrastructure.`,
    {
      properties: {
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_kernels',
    `List available kernels for a Linux server.

Only applicable to servers using managed kernels.
Use with server_action change_kernel to switch kernels.`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_features',
    `Get available advanced features for a server.

Shows features that can be enabled/disabled:
  - virtio_network: VirtIO network driver
  - virtio_disk: VirtIO disk driver
  - uefi: UEFI boot mode
  - And more...`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_threshold_alerts',
    `Get threshold alerts (resource alerts) for a server.

Shows configured alerts for:
  - CPU usage
  - Memory usage
  - Disk usage
  - Network traffic`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'list_exceeded_alerts',
    `List all servers with exceeded threshold alerts.

Returns servers that have triggered resource alerts.
Useful for monitoring infrastructure health.`,
    { properties: {} },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_software',
    `Get licensed software installed on a server.

Shows software like:
  - cPanel/WHM
  - Plesk
  - Other licensed applications

Includes license count and pricing.`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_user_data',
    `Get cloud-init user data configured for a server.

Returns the cloud-init script that runs on server boot.
Useful for reviewing automation configuration.`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_metrics',
    `Get performance metrics for a server.

Returns time-series data for:
  - CPU usage
  - Memory usage
  - Disk I/O (read/write)
  - Network I/O (in/out)

Intervals: five-minute, half-hour, four-hour, day, week, month`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
        data_interval: {
          type: 'string',
          description: 'Data interval',
          enum: ['five-minute', 'half-hour', 'four-hour', 'day', 'week', 'month'],
        },
        start: { type: 'string', description: 'Start time (ISO8601)' },
        end: { type: 'string', description: 'End time (ISO8601)' },
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_server_latest_metrics',
    `Get the most recent performance metrics for a server.

Quick way to check current resource utilization without specifying time range.`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
      },
      required: ['server_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),
];

// ==================== Image Tools ====================

export const imageTools: Tool[] = [
  defineTool(
    'list_images',
    `List available images (operating systems and backups).

Image types:
  - distribution: Official OS images (Ubuntu, Debian, CentOS, etc.)
  - backup: Server backups and snapshots
  - custom: Uploaded custom images

Use to find image IDs/slugs for server creation.`,
    {
      properties: {
        type: { type: 'string', description: 'Filter by type', enum: ['distribution', 'backup', 'custom'] },
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_image',
    `Get details of a specific image.

Accepts either numeric ID or slug (e.g., "ubuntu-24.04-x64").`,
    {
      properties: {
        image_id: { type: 'string', description: 'Image ID or slug' },
      },
      required: ['image_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'delete_image',
    `Delete a backup image.

WARNING: This permanently deletes the backup. Only works for backup images you own.`,
    {
      properties: {
        image_id: { type: 'number', description: 'Backup image ID to delete' },
      },
      required: ['image_id'],
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'update_image',
    `Update backup image name or description.`,
    {
      properties: {
        image_id: { type: 'number', description: 'Image ID' },
        name: { type: 'string', description: 'New name' },
        description: { type: 'string', description: 'New description' },
      },
      required: ['image_id'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_image_download',
    `Get download URL for a backup image.

Returns a temporary URL to download the backup image file.`,
    {
      properties: {
        image_id: { type: 'number', description: 'Image ID' },
      },
      required: ['image_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),
];

// ==================== SSH Key Tools ====================

export const sshKeyTools: Tool[] = [
  defineTool(
    'list_ssh_keys',
    `List all SSH keys in the account.

SSH keys are used for secure root access to servers.
Keys can be added during server creation.`,
    {
      properties: {
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_ssh_key',
    `Get details of a specific SSH key including the public key content.`,
    {
      properties: {
        key_id: { type: 'number', description: 'SSH key ID' },
      },
      required: ['key_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'create_ssh_key',
    `Add a new SSH key to the account.

The public key should be in standard format (ssh-rsa, ssh-ed25519, etc.).
Set as default to automatically add to new servers.`,
    {
      properties: {
        name: { type: 'string', description: 'Friendly name for the key' },
        public_key: { type: 'string', description: 'Public key content' },
        default: { type: 'boolean', description: 'Set as default for new servers' },
      },
      required: ['name', 'public_key'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'update_ssh_key',
    `Update an SSH key's name or default status.`,
    {
      properties: {
        key_id: { type: 'number', description: 'SSH key ID' },
        name: { type: 'string', description: 'New name' },
        default: { type: 'boolean', description: 'Set as default' },
      },
      required: ['key_id'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'delete_ssh_key',
    `Delete an SSH key from the account.

Does not remove the key from existing servers.`,
    {
      properties: {
        key_id: { type: 'number', description: 'SSH key ID to delete' },
      },
      required: ['key_id'],
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  ),
];

// ==================== Domain Tools ====================

export const domainTools: Tool[] = [
  defineTool(
    'list_domains',
    `List all domains managed by BinaryLane DNS.

Returns domains with their current nameserver configuration.`,
    {
      properties: {
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_domain',
    `Get details of a specific domain including zone file.`,
    {
      properties: {
        domain_name: { type: 'string', description: 'Domain name or ID' },
      },
      required: ['domain_name'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'create_domain',
    `Add a new domain to BinaryLane DNS.

After adding, point your domain's nameservers to BinaryLane (use list_nameservers).`,
    {
      properties: {
        name: { type: 'string', description: 'Domain name (e.g., example.com)' },
        ip_address: { type: 'string', description: 'IP for initial A record' },
      },
      required: ['name'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'delete_domain',
    `Remove a domain from BinaryLane DNS.

WARNING: This deletes all DNS records for the domain.`,
    {
      properties: {
        domain_name: { type: 'string', description: 'Domain name to delete' },
      },
      required: ['domain_name'],
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'list_domain_records',
    `List all DNS records for a domain.

Returns records with type, name, data, TTL, and priority.`,
    {
      properties: {
        domain_name: { type: 'string', description: 'Domain name' },
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
      required: ['domain_name'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_domain_record',
    `Get details of a specific DNS record.`,
    {
      properties: {
        domain_name: { type: 'string', description: 'Domain name' },
        record_id: { type: 'number', description: 'Record ID' },
      },
      required: ['domain_name', 'record_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'create_domain_record',
    `Create a new DNS record.

Supported types: A, AAAA, CNAME, MX, TXT, NS, SRV, CAA

Example A record:
  type: "A", name: "www", data: "1.2.3.4"

Example MX record:
  type: "MX", name: "@", data: "mail.example.com", priority: 10`,
    {
      properties: {
        domain_name: { type: 'string', description: 'Domain name' },
        type: { type: 'string', description: 'Record type', enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'] },
        name: { type: 'string', description: 'Record name (e.g., www, @)' },
        data: { type: 'string', description: 'Record value' },
        priority: { type: 'number', description: 'Priority (MX, SRV)' },
        port: { type: 'number', description: 'Port (SRV)' },
        ttl: { type: 'number', description: 'TTL in seconds' },
        weight: { type: 'number', description: 'Weight (SRV)' },
      },
      required: ['domain_name', 'type', 'name', 'data'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'update_domain_record',
    `Update an existing DNS record.`,
    {
      properties: {
        domain_name: { type: 'string', description: 'Domain name' },
        record_id: { type: 'number', description: 'Record ID' },
        type: { type: 'string', description: 'Record type' },
        name: { type: 'string', description: 'Record name' },
        data: { type: 'string', description: 'Record value' },
        priority: { type: 'number', description: 'Priority' },
        ttl: { type: 'number', description: 'TTL' },
      },
      required: ['domain_name', 'record_id'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'delete_domain_record',
    `Delete a DNS record.`,
    {
      properties: {
        domain_name: { type: 'string', description: 'Domain name' },
        record_id: { type: 'number', description: 'Record ID' },
      },
      required: ['domain_name', 'record_id'],
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'list_nameservers',
    `List BinaryLane's public nameservers.

Use these when configuring your domain registrar to use BinaryLane DNS.`,
    { properties: {} },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'refresh_nameserver_cache',
    `Refresh cached nameserver records for a domain.

Use after changing nameservers at your registrar.`,
    {
      properties: {
        domain_name: { type: 'string', description: 'Domain name' },
      },
      required: ['domain_name'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'list_ipv6_reverse_names',
    `List IPv6 reverse DNS (PTR) records.`,
    {
      properties: {
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'update_ipv6_reverse',
    `Update IPv6 reverse DNS (PTR) record.

Sets the hostname that resolves when looking up an IPv6 address.`,
    {
      properties: {
        server_id: { type: 'number', description: 'Server ID' },
        ip_address: { type: 'string', description: 'IPv6 address' },
        reverse_name: { type: 'string', description: 'Reverse DNS name' },
      },
      required: ['server_id', 'ip_address', 'reverse_name'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),
];

// ==================== VPC Tools ====================

export const vpcTools: Tool[] = [
  defineTool(
    'list_vpcs',
    `List all VPCs (Virtual Private Clouds).

VPCs provide isolated private networks for your servers.`,
    {
      properties: {
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_vpc',
    `Get details of a specific VPC including IP range and routes.`,
    {
      properties: {
        vpc_id: { type: 'number', description: 'VPC ID' },
      },
      required: ['vpc_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'create_vpc',
    `Create a new VPC.

IP range is auto-assigned if not specified.
Example: 10.240.0.0/16`,
    {
      properties: {
        name: { type: 'string', description: 'VPC name' },
        ip_range: { type: 'string', description: 'CIDR notation (e.g., 10.240.0.0/16)' },
      },
      required: ['name'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'update_vpc',
    `Update VPC name or route entries.`,
    {
      properties: {
        vpc_id: { type: 'number', description: 'VPC ID' },
        name: { type: 'string', description: 'New name' },
        route_entries: {
          type: 'array',
          description: 'Custom routes',
          items: {
            type: 'object',
            properties: {
              router: { type: 'string' },
              destination: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
      required: ['vpc_id'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'delete_vpc',
    `Delete a VPC.

VPC must be empty (no servers) before deletion.`,
    {
      properties: {
        vpc_id: { type: 'number', description: 'VPC ID' },
      },
      required: ['vpc_id'],
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'get_vpc_members',
    `List all members (servers, load balancers) in a VPC.`,
    {
      properties: {
        vpc_id: { type: 'number', description: 'VPC ID' },
        resource_type: { type: 'string', description: 'Filter by type', enum: ['server', 'load-balancer'] },
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
      required: ['vpc_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),
];

// ==================== Load Balancer Tools ====================

export const loadBalancerTools: Tool[] = [
  defineTool(
    'list_load_balancers',
    `List all load balancers.`,
    {
      properties: {
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_load_balancer',
    `Get details of a specific load balancer.`,
    {
      properties: {
        load_balancer_id: { type: 'number', description: 'Load balancer ID' },
      },
      required: ['load_balancer_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'create_load_balancer',
    `Create a new load balancer.

Requires at least one forwarding rule.
Example forwarding rule:
  entry_protocol: "http", entry_port: 80,
  target_protocol: "http", target_port: 8080`,
    {
      properties: {
        name: { type: 'string', description: 'Load balancer name' },
        region: { type: 'string', description: 'Region slug' },
        forwarding_rules: {
          type: 'array',
          description: 'Forwarding rules',
          items: {
            type: 'object',
            properties: {
              entry_protocol: { type: 'string' },
              entry_port: { type: 'number' },
              target_protocol: { type: 'string' },
              target_port: { type: 'number' },
            },
          },
        },
        server_ids: { type: 'array', items: { type: 'number' }, description: 'Backend servers' },
        algorithm: { type: 'string', description: 'round_robin or least_connections' },
      },
      required: ['name', 'region', 'forwarding_rules'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'update_load_balancer',
    `Update load balancer configuration.`,
    {
      properties: {
        load_balancer_id: { type: 'number', description: 'Load balancer ID' },
        name: { type: 'string', description: 'New name' },
        server_ids: { type: 'array', items: { type: 'number' }, description: 'Server IDs' },
        algorithm: { type: 'string', description: 'Algorithm' },
      },
      required: ['load_balancer_id'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'delete_load_balancer',
    `Delete a load balancer.`,
    {
      properties: {
        load_balancer_id: { type: 'number', description: 'Load balancer ID' },
      },
      required: ['load_balancer_id'],
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
  ),

  defineTool(
    'get_load_balancer_availability',
    `Check load balancer availability and pricing in a region.`,
    {
      properties: {
        region: { type: 'string', description: 'Region slug' },
      },
      required: ['region'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'add_servers_to_load_balancer',
    `Add backend servers to a load balancer.`,
    {
      properties: {
        load_balancer_id: { type: 'number', description: 'Load balancer ID' },
        server_ids: { type: 'array', items: { type: 'number' }, description: 'Server IDs to add' },
      },
      required: ['load_balancer_id', 'server_ids'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'remove_servers_from_load_balancer',
    `Remove backend servers from a load balancer.`,
    {
      properties: {
        load_balancer_id: { type: 'number', description: 'Load balancer ID' },
        server_ids: { type: 'array', items: { type: 'number' }, description: 'Server IDs to remove' },
      },
      required: ['load_balancer_id', 'server_ids'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'add_forwarding_rules',
    `Add forwarding rules to a load balancer.`,
    {
      properties: {
        load_balancer_id: { type: 'number', description: 'Load balancer ID' },
        forwarding_rules: {
          type: 'array',
          description: 'Rules to add',
          items: {
            type: 'object',
            properties: {
              entry_protocol: { type: 'string' },
              entry_port: { type: 'number' },
              target_protocol: { type: 'string' },
              target_port: { type: 'number' },
            },
          },
        },
      },
      required: ['load_balancer_id', 'forwarding_rules'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'remove_forwarding_rules',
    `Remove forwarding rules from a load balancer.`,
    {
      properties: {
        load_balancer_id: { type: 'number', description: 'Load balancer ID' },
        forwarding_rules: {
          type: 'array',
          description: 'Rules to remove',
          items: {
            type: 'object',
            properties: {
              entry_protocol: { type: 'string' },
              entry_port: { type: 'number' },
              target_protocol: { type: 'string' },
              target_port: { type: 'number' },
            },
          },
        },
      },
      required: ['load_balancer_id', 'forwarding_rules'],
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),
];

// ==================== Region & Size Tools ====================

export const regionSizeTools: Tool[] = [
  defineTool(
    'list_regions',
    `List all available regions (data centers).

BinaryLane regions:
  - syd: Sydney
  - mel: Melbourne
  - bne: Brisbane
  - per: Perth`,
    { properties: {} },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'list_sizes',
    `List all available server sizes.

Shows pricing, specs, and availability.
Filter by server_id to see resize options.`,
    {
      properties: {
        server_id: { type: 'number', description: 'Show sizes for resizing this server' },
        image: { type: 'string', description: 'Filter by image compatibility' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),
];

// ==================== Action Tools ====================

export const actionTools: Tool[] = [
  defineTool(
    'list_actions',
    `List all recent actions across the account.

Shows operation history for all resources.`,
    {
      properties: {
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_action',
    `Get details of a specific action.`,
    {
      properties: {
        action_id: { type: 'number', description: 'Action ID' },
      },
      required: ['action_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),
];

// ==================== Software Tools ====================

export const softwareTools: Tool[] = [
  defineTool(
    'list_software',
    `List all available licensed software.

Includes cPanel, Plesk, and other licensed applications.`,
    {
      properties: {
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'get_software',
    `Get details of a specific software product.`,
    {
      properties: {
        software_id: { type: 'number', description: 'Software ID' },
      },
      required: ['software_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),

  defineTool(
    'list_software_for_os',
    `List software available for a specific operating system.`,
    {
      properties: {
        operating_system_id: { type: 'string', description: 'OS ID or slug' },
        page: { type: 'number', description: 'Page number' },
        per_page: { type: 'number', description: 'Results per page' },
      },
      required: ['operating_system_id'],
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  ),
];

// ==================== All Tools ====================

export const allTools: Tool[] = [
  ...accountTools,
  ...serverTools,
  ...imageTools,
  ...sshKeyTools,
  ...domainTools,
  ...vpcTools,
  ...loadBalancerTools,
  ...regionSizeTools,
  ...actionTools,
  ...softwareTools,
];
