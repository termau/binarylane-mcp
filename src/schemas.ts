/**
 * Zod schemas for BinaryLane MCP Server
 * Provides runtime input validation with descriptive error messages
 */

import { z } from 'zod';

// ==================== Common Schemas ====================

export const PaginationSchema = z.object({
  page: z.number()
    .int()
    .min(1)
    .max(2147483647)
    .default(1)
    .describe('Page number (starts at 1)'),
  per_page: z.number()
    .int()
    .min(1)
    .max(200)
    .default(20)
    .describe('Results per page (max 200)'),
}).partial();

// ==================== Account Schemas ====================

export const GetInvoiceSchema = z.object({
  invoice_id: z.number()
    .int()
    .positive()
    .describe('The invoice ID to fetch'),
});

export const ProceedActionSchema = z.object({
  action_id: z.number()
    .int()
    .positive()
    .describe('The action ID to respond to'),
  proceed: z.boolean()
    .describe('Whether to proceed with the action (true) or cancel it (false)'),
});

// ==================== Server Schemas ====================

export const ServerIdSchema = z.object({
  server_id: z.number()
    .int()
    .positive()
    .describe('The server ID'),
});

export const ListServersSchema = PaginationSchema.extend({
  hostname: z.string()
    .optional()
    .describe('Filter servers by hostname (partial match)'),
});

export const CreateServerSchema = z.object({
  size: z.string()
    .min(1)
    .describe('Size slug (e.g., "std-min", "std-1vcpu-1gb", "std-2vcpu-2gb"). Use list_sizes to see available options.'),
  image: z.union([z.string(), z.number()])
    .describe('Image ID or slug (e.g., "ubuntu-24.04-x64", "debian-12-x64"). Use list_images to see available options.'),
  region: z.string()
    .min(1)
    .describe('Region slug (e.g., "syd" for Sydney, "mel" for Melbourne, "bne" for Brisbane, "per" for Perth)'),
  name: z.string()
    .max(250)
    .optional()
    .describe('Server hostname (auto-generated if not provided)'),
  backups: z.boolean()
    .optional()
    .describe('Enable automatic backups (additional cost applies)'),
  ipv6: z.boolean()
    .optional()
    .describe('Enable IPv6 networking'),
  vpc_id: z.number()
    .int()
    .positive()
    .optional()
    .describe('VPC ID to add server to for private networking'),
  ssh_keys: z.array(z.union([z.number(), z.string()]))
    .optional()
    .describe('SSH key IDs or fingerprints to add for root access'),
  user_data: z.string()
    .max(65535)
    .optional()
    .describe('Cloud-init user data script for server initialization'),
  password: z.string()
    .optional()
    .describe('Root password (auto-generated if not provided, returned in response)'),
  port_blocking: z.boolean()
    .optional()
    .describe('Enable outbound port blocking (blocks common spam/attack ports)'),
  options: z.object({
    ipv4_addresses: z.number().int().min(1).optional(),
    memory: z.number().int().optional(),
    disk: z.number().int().optional(),
    transfer: z.number().int().optional(),
    offsite_backup_copies: z.number().int().min(0).optional(),
  }).optional()
    .describe('Size option overrides (memory in MB, disk in GB, transfer in TB)'),
});

export const DeleteServerSchema = z.object({
  server_id: z.number()
    .int()
    .positive()
    .describe('The server ID to delete/cancel'),
  reason: z.string()
    .max(500)
    .optional()
    .describe('Reason for cancellation (for internal records)'),
});

// Server Action Types
export const ServerActionType = z.enum([
  // Power actions
  'power_on', 'power_off', 'reboot', 'shutdown', 'power_cycle',
  // Status checks
  'ping', 'uptime', 'is_running',
  // Password & Security
  'password_reset', 'disable_selinux',
  // Backups
  'take_backup', 'restore', 'enable_backups', 'disable_backups',
  'attach_backup', 'detach_backup', 'clone_using_backup',
  'change_backup_schedule', 'change_offsite_backup_location', 'change_manage_offsite_backup_copies',
  // Rebuild & Resize
  'rebuild', 'resize', 'change_region',
  // Disk operations
  'add_disk', 'resize_disk', 'delete_disk',
  // Network
  'enable_ipv6', 'change_ipv6', 'change_port_blocking',
  'change_network', 'change_vpc_ipv4',
  'change_reverse_name', 'change_ipv6_reverse_nameservers',
  'change_separate_private_network_interface', 'change_source_and_destination_check',
  // Configuration
  'rename', 'uncancel', 'change_kernel', 'change_partner',
  'change_advanced_features', 'change_advanced_firewall_rules', 'change_threshold_alerts',
]);

export const ServerActionSchema = z.object({
  server_id: z.number()
    .int()
    .positive()
    .describe('The server ID to perform the action on'),
  action_type: ServerActionType
    .describe('The action to perform'),
  // Parameters for specific actions
  image: z.union([z.string(), z.number()])
    .optional()
    .describe('Image ID/slug for rebuild, attach_backup actions'),
  size: z.string()
    .optional()
    .describe('Size slug for resize action'),
  name: z.string()
    .optional()
    .describe('New hostname for rename action'),
  backup_type: z.enum(['daily', 'weekly', 'monthly', 'temporary'])
    .optional()
    .describe('Backup type for take_backup action. Required unless replacement_strategy is "specified".'),
  replacement_strategy: z.enum(['none', 'specified', 'oldest', 'newest'])
    .optional()
    .describe('Strategy for selecting which backup to replace. Required for take_backup. "none" = use a free slot (error if none), "specified" = replace backup_id_to_replace, "oldest" = replace oldest if no free slots, "newest" = replace newest if no free slots.'),
  backup_id_to_replace: z.number()
    .int()
    .optional()
    .describe('Backup ID to replace when replacement_strategy is "specified"'),
  label: z.string()
    .optional()
    .describe('Label/description for take_backup action'),
  // Disk operations
  disk_id: z.number()
    .int()
    .optional()
    .describe('Disk ID for resize_disk, delete_disk actions'),
  size_gigabytes: z.number()
    .int()
    .min(20)
    .optional()
    .describe('New disk size in GB for add_disk, resize_disk actions'),
  // Network options
  ipv4_address: z.string()
    .optional()
    .describe('IPv4 address for change_vpc_ipv4 action'),
  reverse_name: z.string()
    .optional()
    .describe('Reverse DNS name for change_reverse_name action'),
  enabled: z.boolean()
    .optional()
    .describe('Enable/disable flag for various toggle actions'),
  // Advanced features
  features: z.record(z.string(), z.boolean())
    .optional()
    .describe('Feature map for change_advanced_features action'),
  firewall_rules: z.array(z.object({
    source_addresses: z.array(z.string()),
    destination_addresses: z.array(z.string()),
    destination_ports: z.array(z.string()).optional(),
    protocol: z.enum(['tcp', 'udp', 'icmp', 'all']),
    action: z.enum(['accept', 'drop']),
    description: z.string().optional(),
  })).optional()
    .describe('Firewall rules for change_advanced_firewall_rules action'),
  // Threshold alerts
  threshold_alerts: z.array(z.object({
    alert_type: z.string(),
    value: z.number(),
    enabled: z.boolean(),
  })).optional()
    .describe('Threshold alerts for change_threshold_alerts action'),
  // Clone/restore
  target_server_id: z.number()
    .int()
    .optional()
    .describe('Target server ID for clone_using_backup action'),
  // Kernel
  kernel_id: z.number()
    .int()
    .optional()
    .describe('Kernel ID for change_kernel action'),
  // Region
  region: z.string()
    .optional()
    .describe('Region slug for change_region action'),
});

export const ServerMetricsSchema = z.object({
  server_id: z.number()
    .int()
    .positive()
    .describe('The server ID'),
  data_interval: z.enum(['five-minute', 'half-hour', 'four-hour', 'day', 'week', 'month'])
    .optional()
    .describe('Data aggregation interval'),
  start: z.string()
    .optional()
    .describe('Start time in ISO8601 format (e.g., "2024-01-01T00:00:00Z")'),
  end: z.string()
    .optional()
    .describe('End time in ISO8601 format'),
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(200).optional(),
});

export const UploadBackupSchema = z.object({
  server_id: z.number()
    .int()
    .positive()
    .describe('The server ID to upload backup for'),
  url: z.string()
    .url()
    .describe('URL of the backup image to upload (must be publicly accessible)'),
  label: z.string()
    .optional()
    .describe('Label for the uploaded backup'),
  backup_type: z.enum(['daily', 'weekly', 'monthly', 'temporary'])
    .optional()
    .describe('Backup type classification'),
});

// ==================== Image Schemas ====================

export const ListImagesSchema = PaginationSchema.extend({
  type: z.enum(['distribution', 'backup', 'custom'])
    .optional()
    .describe('Filter by image type'),
});

export const ImageIdSchema = z.object({
  image_id: z.union([z.number(), z.string()])
    .describe('Image ID or slug (e.g., "ubuntu-24.04-x64" or 12345)'),
});

export const UpdateImageSchema = z.object({
  image_id: z.number()
    .int()
    .positive()
    .describe('Image ID to update'),
  name: z.string()
    .max(250)
    .optional()
    .describe('New image name'),
  description: z.string()
    .max(1000)
    .optional()
    .describe('New image description'),
});

// ==================== SSH Key Schemas ====================

export const SshKeyIdSchema = z.object({
  key_id: z.number()
    .int()
    .positive()
    .describe('SSH key ID'),
});

export const CreateSshKeySchema = z.object({
  name: z.string()
    .min(1)
    .max(250)
    .describe('Friendly name for the SSH key'),
  public_key: z.string()
    .min(1)
    .describe('Public key content (e.g., "ssh-rsa AAAA... user@host")'),
  default: z.boolean()
    .optional()
    .describe('Set as default key for new servers'),
});

export const UpdateSshKeySchema = z.object({
  key_id: z.number()
    .int()
    .positive()
    .describe('SSH key ID to update'),
  name: z.string()
    .max(250)
    .optional()
    .describe('New name for the key'),
  default: z.boolean()
    .optional()
    .describe('Set as default key'),
});

// ==================== Domain Schemas ====================

export const DomainNameSchema = z.object({
  domain_name: z.union([z.string(), z.number()])
    .describe('Domain name (e.g., "example.com") or domain ID'),
});

export const CreateDomainSchema = z.object({
  name: z.string()
    .min(1)
    .describe('Domain name to add (e.g., "example.com")'),
  ip_address: z.string()
    .regex(/^(?:\d{1,3}\.){3}\d{1,3}$|^([a-fA-F0-9:]+)$/, 'Invalid IP address format')
    .optional()
    .describe('IP address for initial A record (optional)'),
});

export const DomainRecordSchema = z.object({
  domain_name: z.union([z.string(), z.number()])
    .describe('Domain name or ID'),
  record_id: z.number()
    .int()
    .positive()
    .describe('DNS record ID'),
});

export const CreateDomainRecordSchema = z.object({
  domain_name: z.union([z.string(), z.number()])
    .describe('Domain name or ID'),
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'])
    .describe('DNS record type'),
  name: z.string()
    .describe('Record name (e.g., "www", "@" for root, "subdomain")'),
  data: z.string()
    .describe('Record value (IP address, hostname, or text depending on type)'),
  priority: z.number()
    .int()
    .min(0)
    .max(65535)
    .optional()
    .describe('Priority for MX and SRV records (lower = higher priority)'),
  port: z.number()
    .int()
    .min(0)
    .max(65535)
    .optional()
    .describe('Port for SRV records'),
  ttl: z.number()
    .int()
    .min(60)
    .max(86400)
    .optional()
    .describe('TTL in seconds (default: 3600)'),
  weight: z.number()
    .int()
    .min(0)
    .optional()
    .describe('Weight for SRV records'),
  flags: z.number()
    .int()
    .min(0)
    .max(255)
    .optional()
    .describe('Flags for CAA records'),
  tag: z.string()
    .optional()
    .describe('Tag for CAA records (e.g., "issue", "issuewild")'),
});

export const UpdateDomainRecordSchema = CreateDomainRecordSchema.partial().extend({
  domain_name: z.union([z.string(), z.number()])
    .describe('Domain name or ID'),
  record_id: z.number()
    .int()
    .positive()
    .describe('DNS record ID to update'),
});

// ==================== VPC Schemas ====================

export const VpcIdSchema = z.object({
  vpc_id: z.number()
    .int()
    .positive()
    .describe('VPC ID'),
});

export const CreateVpcSchema = z.object({
  name: z.string()
    .min(1)
    .max(250)
    .describe('VPC name'),
  ip_range: z.string()
    .optional()
    .describe('IP range in CIDR notation (e.g., "10.240.0.0/16"). Auto-assigned if not specified.'),
});

export const RouteEntrySchema = z.object({
  router: z.string()
    .describe('Router IP address'),
  destination: z.string()
    .describe('Destination CIDR'),
  description: z.string()
    .optional()
    .describe('Route description'),
});

export const UpdateVpcSchema = z.object({
  vpc_id: z.number()
    .int()
    .positive()
    .describe('VPC ID to update'),
  name: z.string()
    .max(250)
    .optional()
    .describe('New VPC name'),
  route_entries: z.array(RouteEntrySchema)
    .optional()
    .describe('Custom route entries'),
});

export const VpcMembersSchema = z.object({
  vpc_id: z.number()
    .int()
    .positive()
    .describe('VPC ID'),
  resource_type: z.enum(['server', 'load-balancer'])
    .optional()
    .describe('Filter by resource type'),
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(200).optional(),
});

// ==================== Load Balancer Schemas ====================

export const LoadBalancerIdSchema = z.object({
  load_balancer_id: z.number()
    .int()
    .positive()
    .describe('Load balancer ID'),
});

export const ForwardingRuleSchema = z.object({
  entry_protocol: z.enum(['http', 'https', 'tcp', 'udp'])
    .describe('Protocol for incoming traffic'),
  entry_port: z.number()
    .int()
    .min(1)
    .max(65535)
    .describe('Port for incoming traffic'),
  target_protocol: z.enum(['http', 'https', 'tcp', 'udp'])
    .describe('Protocol for backend servers'),
  target_port: z.number()
    .int()
    .min(1)
    .max(65535)
    .describe('Port on backend servers'),
  certificate_id: z.string()
    .optional()
    .describe('SSL certificate ID for HTTPS'),
  tls_passthrough: z.boolean()
    .optional()
    .describe('Pass TLS directly to backend (for HTTPS)'),
});

export const HealthCheckSchema = z.object({
  protocol: z.enum(['http', 'https', 'tcp'])
    .describe('Health check protocol'),
  port: z.number()
    .int()
    .min(1)
    .max(65535)
    .describe('Health check port'),
  path: z.string()
    .optional()
    .describe('Health check path for HTTP/HTTPS'),
  check_interval_seconds: z.number()
    .int()
    .min(3)
    .max(300)
    .optional()
    .describe('Interval between health checks'),
  response_timeout_seconds: z.number()
    .int()
    .min(3)
    .max(300)
    .optional()
    .describe('Timeout for health check response'),
  unhealthy_threshold: z.number()
    .int()
    .min(2)
    .max(10)
    .optional()
    .describe('Failed checks before marking unhealthy'),
  healthy_threshold: z.number()
    .int()
    .min(2)
    .max(10)
    .optional()
    .describe('Successful checks before marking healthy'),
});

export const CreateLoadBalancerSchema = z.object({
  name: z.string()
    .min(1)
    .max(250)
    .describe('Load balancer name'),
  region: z.string()
    .min(1)
    .describe('Region slug (e.g., "syd", "mel")'),
  forwarding_rules: z.array(ForwardingRuleSchema)
    .min(1)
    .describe('At least one forwarding rule is required'),
  health_check: HealthCheckSchema
    .optional()
    .describe('Health check configuration'),
  sticky_sessions: z.object({
    type: z.enum(['cookies', 'none']).optional(),
    cookie_name: z.string().optional(),
    cookie_ttl_seconds: z.number().int().optional(),
  }).optional()
    .describe('Sticky session configuration'),
  server_ids: z.array(z.number().int().positive())
    .optional()
    .describe('Server IDs to add to the load balancer'),
  algorithm: z.enum(['round_robin', 'least_connections'])
    .optional()
    .describe('Load balancing algorithm'),
  size_slug: z.string()
    .optional()
    .describe('Load balancer size'),
});

export const UpdateLoadBalancerSchema = z.object({
  load_balancer_id: z.number()
    .int()
    .positive()
    .describe('Load balancer ID to update'),
  name: z.string()
    .max(250)
    .optional()
    .describe('New name'),
  forwarding_rules: z.array(ForwardingRuleSchema)
    .optional()
    .describe('Updated forwarding rules'),
  health_check: HealthCheckSchema
    .optional()
    .describe('Updated health check'),
  server_ids: z.array(z.number().int().positive())
    .optional()
    .describe('Updated server list'),
  algorithm: z.enum(['round_robin', 'least_connections'])
    .optional()
    .describe('Updated algorithm'),
});

export const LoadBalancerServersSchema = z.object({
  load_balancer_id: z.number()
    .int()
    .positive()
    .describe('Load balancer ID'),
  server_ids: z.array(z.number().int().positive())
    .min(1)
    .describe('Server IDs to add/remove'),
});

export const LoadBalancerRulesSchema = z.object({
  load_balancer_id: z.number()
    .int()
    .positive()
    .describe('Load balancer ID'),
  forwarding_rules: z.array(ForwardingRuleSchema)
    .min(1)
    .describe('Forwarding rules to add/remove'),
});

export const LoadBalancerAvailabilitySchema = z.object({
  region: z.string()
    .min(1)
    .describe('Region slug to check availability'),
});

// ==================== Size & Region Schemas ====================

export const ListSizesSchema = z.object({
  server_id: z.number()
    .int()
    .positive()
    .optional()
    .describe('Show sizes available for resizing this server'),
  image: z.union([z.string(), z.number()])
    .optional()
    .describe('Filter sizes compatible with this image'),
});

// ==================== Action Schemas ====================

export const ActionIdSchema = z.object({
  action_id: z.number()
    .int()
    .positive()
    .describe('Action ID'),
});

// ==================== Software Schemas ====================

export const SoftwareIdSchema = z.object({
  software_id: z.number()
    .int()
    .positive()
    .describe('Software ID'),
});

export const SoftwareForOSSchema = z.object({
  operating_system_id: z.union([z.string(), z.number()])
    .describe('Operating system ID or slug (e.g., "ubuntu-24.04-x64")'),
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(200).optional(),
});

// ==================== Reverse DNS Schemas ====================

export const UpdateIpv6ReverseSchema = z.object({
  server_id: z.number()
    .int()
    .positive()
    .describe('Server ID'),
  ip_address: z.string()
    .describe('IPv6 address to update'),
  reverse_name: z.string()
    .describe('Reverse DNS name (e.g., "mail.example.com")'),
});
