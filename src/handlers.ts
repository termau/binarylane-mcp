/**
 * Tool handlers for BinaryLane MCP Server
 * Maps tool names to their implementation functions
 */

import { BinaryLaneClient, ServerAction } from './api-client.js';
import * as schemas from './schemas.js';
import { z } from 'zod';

type ToolHandler = (client: BinaryLaneClient, args: unknown) => Promise<unknown>;

// Helper to format successful responses
function formatSuccess(message: string): { success: true; message: string } {
  return { success: true, message };
}

// ==================== Account Handlers ====================

export const accountHandlers: Record<string, ToolHandler> = {
  get_account: async (client) => client.getAccount(),

  get_balance: async (client) => client.getBalance(),

  list_invoices: async (client, args) => {
    const params = schemas.PaginationSchema.parse(args);
    return client.getInvoices(params);
  },

  get_invoice: async (client, args) => {
    const { invoice_id } = schemas.GetInvoiceSchema.parse(args);
    return client.getInvoice(invoice_id);
  },

  get_unpaid_invoices: async (client) => client.getUnpaidFailedInvoices(),

  proceed_action: async (client, args) => {
    const { action_id, proceed } = schemas.ProceedActionSchema.parse(args);
    await client.proceedAction(action_id, proceed);
    return formatSuccess(`Action ${action_id} ${proceed ? 'confirmed' : 'cancelled'}`);
  },
};

// ==================== Server Handlers ====================

export const serverHandlers: Record<string, ToolHandler> = {
  list_servers: async (client, args) => {
    const params = schemas.ListServersSchema.parse(args);
    return client.listServers(params);
  },

  get_server: async (client, args) => {
    const { server_id } = schemas.ServerIdSchema.parse(args);
    return client.getServer(server_id);
  },

  create_server: async (client, args) => {
    const params = schemas.CreateServerSchema.parse(args);
    return client.createServer(params);
  },

  delete_server: async (client, args) => {
    const { server_id, reason } = schemas.DeleteServerSchema.parse(args);
    await client.deleteServer(server_id, reason);
    return formatSuccess(`Server ${server_id} deletion initiated`);
  },

  server_action: async (client, args) => {
    const params = schemas.ServerActionSchema.parse(args);
    const action: ServerAction = { type: params.action_type };

    // Map parameters to action object based on action type
    if (params.image !== undefined) action.image = params.image;
    if (params.size !== undefined) action.size = params.size;
    if (params.name !== undefined) action.name = params.name;
    if (params.backup_type !== undefined) action.backup_type = params.backup_type;
    if (params.label !== undefined) action.label = params.label;
    if (params.disk_id !== undefined) action.disk_id = params.disk_id;
    if (params.size_gigabytes !== undefined) action.size_gigabytes = params.size_gigabytes;
    if (params.ipv4_address !== undefined) action.ipv4_address = params.ipv4_address;
    if (params.reverse_name !== undefined) action.reverse_name = params.reverse_name;
    if (params.enabled !== undefined) action.enabled = params.enabled;
    if (params.features !== undefined) action.enabled_features = params.features;
    if (params.firewall_rules !== undefined) action.firewall_rules = params.firewall_rules;
    if (params.threshold_alerts !== undefined) action.threshold_alerts = params.threshold_alerts;
    if (params.target_server_id !== undefined) action.target_server_id = params.target_server_id;
    if (params.kernel_id !== undefined) action.kernel = params.kernel_id;
    if (params.region !== undefined) action.region = params.region;

    return client.performServerAction(params.server_id, action);
  },

  list_server_actions: async (client, args) => {
    const parsed = schemas.ServerIdSchema.merge(schemas.PaginationSchema).parse(args);
    return client.listServerActions(parsed.server_id, parsed);
  },

  get_server_action: async (client, args) => {
    const parsed = z.object({
      server_id: z.number().int().positive(),
      action_id: z.number().int().positive(),
    }).parse(args);
    return client.getServerAction(parsed.server_id, parsed.action_id);
  },

  get_server_backups: async (client, args) => {
    const parsed = schemas.ServerIdSchema.merge(schemas.PaginationSchema).parse(args);
    return client.getServerBackups(parsed.server_id, parsed);
  },

  get_server_snapshots: async (client, args) => {
    const parsed = schemas.ServerIdSchema.merge(schemas.PaginationSchema).parse(args);
    return client.getServerSnapshots(parsed.server_id, parsed);
  },

  upload_backup: async (client, args) => {
    const params = schemas.UploadBackupSchema.parse(args);
    return client.uploadBackup(params.server_id, {
      url: params.url,
      label: params.label,
      backup_type: params.backup_type,
    });
  },

  get_server_firewall: async (client, args) => {
    const { server_id } = schemas.ServerIdSchema.parse(args);
    return client.getServerFirewallRules(server_id);
  },

  get_server_console: async (client, args) => {
    const { server_id } = schemas.ServerIdSchema.parse(args);
    return client.getServerConsole(server_id);
  },

  get_data_usage: async (client, args) => {
    const { server_id } = schemas.ServerIdSchema.parse(args);
    return client.getCurrentDataUsage(server_id);
  },

  list_all_data_usage: async (client, args) => {
    const params = schemas.PaginationSchema.parse(args);
    return client.listAllDataUsage(params);
  },

  get_server_kernels: async (client, args) => {
    const parsed = schemas.ServerIdSchema.merge(schemas.PaginationSchema).parse(args);
    return client.getServerKernels(parsed.server_id, parsed);
  },

  get_server_features: async (client, args) => {
    const { server_id } = schemas.ServerIdSchema.parse(args);
    return client.getServerAvailableFeatures(server_id);
  },

  get_server_threshold_alerts: async (client, args) => {
    const { server_id } = schemas.ServerIdSchema.parse(args);
    return client.getServerThresholdAlerts(server_id);
  },

  list_exceeded_alerts: async (client) => client.listExceededThresholdAlerts(),

  get_server_software: async (client, args) => {
    const parsed = schemas.ServerIdSchema.merge(schemas.PaginationSchema).parse(args);
    return client.getServerSoftware(parsed.server_id, parsed);
  },

  get_server_user_data: async (client, args) => {
    const { server_id } = schemas.ServerIdSchema.parse(args);
    return client.getServerUserData(server_id);
  },

  get_server_metrics: async (client, args) => {
    const params = schemas.ServerMetricsSchema.parse(args);
    return client.getServerMetrics(params.server_id, params);
  },

  get_server_latest_metrics: async (client, args) => {
    const { server_id } = schemas.ServerIdSchema.parse(args);
    return client.getServerLatestMetrics(server_id);
  },
};

// ==================== Image Handlers ====================

export const imageHandlers: Record<string, ToolHandler> = {
  list_images: async (client, args) => {
    const params = schemas.ListImagesSchema.parse(args);
    return client.listImages(params);
  },

  get_image: async (client, args) => {
    const { image_id } = schemas.ImageIdSchema.parse(args);
    return client.getImage(image_id);
  },

  delete_image: async (client, args) => {
    const { image_id } = z.object({ image_id: z.number().int().positive() }).parse(args);
    await client.deleteImage(image_id);
    return formatSuccess(`Image ${image_id} deleted`);
  },

  update_image: async (client, args) => {
    const { image_id, ...rest } = schemas.UpdateImageSchema.parse(args);
    return client.updateImage(image_id, rest);
  },

  get_image_download: async (client, args) => {
    const { image_id } = z.object({ image_id: z.number().int().positive() }).parse(args);
    return client.getImageDownload(image_id);
  },
};

// ==================== SSH Key Handlers ====================

export const sshKeyHandlers: Record<string, ToolHandler> = {
  list_ssh_keys: async (client, args) => {
    const params = schemas.PaginationSchema.parse(args);
    return client.listSshKeys(params);
  },

  get_ssh_key: async (client, args) => {
    const { key_id } = schemas.SshKeyIdSchema.parse(args);
    return client.getSshKey(key_id);
  },

  create_ssh_key: async (client, args) => {
    const params = schemas.CreateSshKeySchema.parse(args);
    return client.createSshKey(params);
  },

  update_ssh_key: async (client, args) => {
    const { key_id, ...rest } = schemas.UpdateSshKeySchema.parse(args);
    return client.updateSshKey(key_id, rest);
  },

  delete_ssh_key: async (client, args) => {
    const { key_id } = schemas.SshKeyIdSchema.parse(args);
    await client.deleteSshKey(key_id);
    return formatSuccess(`SSH key ${key_id} deleted`);
  },
};

// ==================== Domain Handlers ====================

export const domainHandlers: Record<string, ToolHandler> = {
  list_domains: async (client, args) => {
    const params = schemas.PaginationSchema.parse(args);
    return client.listDomains(params);
  },

  get_domain: async (client, args) => {
    const { domain_name } = schemas.DomainNameSchema.parse(args);
    return client.getDomain(domain_name);
  },

  create_domain: async (client, args) => {
    const params = schemas.CreateDomainSchema.parse(args);
    return client.createDomain(params);
  },

  delete_domain: async (client, args) => {
    const { domain_name } = schemas.DomainNameSchema.parse(args);
    await client.deleteDomain(domain_name);
    return formatSuccess(`Domain ${domain_name} deleted`);
  },

  list_domain_records: async (client, args) => {
    const parsed = schemas.DomainNameSchema.merge(schemas.PaginationSchema).parse(args);
    return client.listDomainRecords(parsed.domain_name, parsed);
  },

  get_domain_record: async (client, args) => {
    const { domain_name, record_id } = schemas.DomainRecordSchema.parse(args);
    return client.getDomainRecord(domain_name, record_id);
  },

  create_domain_record: async (client, args) => {
    const { domain_name, ...rest } = schemas.CreateDomainRecordSchema.parse(args);
    return client.createDomainRecord(domain_name, rest);
  },

  update_domain_record: async (client, args) => {
    const { domain_name, record_id, ...rest } = schemas.UpdateDomainRecordSchema.parse(args);
    return client.updateDomainRecord(domain_name, record_id, rest);
  },

  delete_domain_record: async (client, args) => {
    const { domain_name, record_id } = schemas.DomainRecordSchema.parse(args);
    await client.deleteDomainRecord(domain_name, record_id);
    return formatSuccess(`DNS record ${record_id} deleted`);
  },

  list_nameservers: async (client) => client.listNameservers(),

  refresh_nameserver_cache: async (client, args) => {
    const { domain_name } = schemas.DomainNameSchema.parse(args);
    await client.refreshNameserverCache(String(domain_name));
    return formatSuccess(`Nameserver cache refreshed for ${domain_name}`);
  },

  list_ipv6_reverse_names: async (client, args) => {
    const params = schemas.PaginationSchema.parse(args);
    return client.listIpv6ReverseName(params);
  },

  update_ipv6_reverse: async (client, args) => {
    const params = schemas.UpdateIpv6ReverseSchema.parse(args);
    return client.updateIpv6Reverse(params.server_id, params.ip_address, params.reverse_name);
  },
};

// ==================== VPC Handlers ====================

export const vpcHandlers: Record<string, ToolHandler> = {
  list_vpcs: async (client, args) => {
    const params = schemas.PaginationSchema.parse(args);
    return client.listVpcs(params);
  },

  get_vpc: async (client, args) => {
    const { vpc_id } = schemas.VpcIdSchema.parse(args);
    return client.getVpc(vpc_id);
  },

  create_vpc: async (client, args) => {
    const params = schemas.CreateVpcSchema.parse(args);
    return client.createVpc(params);
  },

  update_vpc: async (client, args) => {
    const { vpc_id, ...rest } = schemas.UpdateVpcSchema.parse(args);
    return client.updateVpc(vpc_id, rest);
  },

  delete_vpc: async (client, args) => {
    const { vpc_id } = schemas.VpcIdSchema.parse(args);
    await client.deleteVpc(vpc_id);
    return formatSuccess(`VPC ${vpc_id} deleted`);
  },

  get_vpc_members: async (client, args) => {
    const params = schemas.VpcMembersSchema.parse(args);
    return client.getVpcMembers(params.vpc_id, params);
  },
};

// ==================== Load Balancer Handlers ====================

export const loadBalancerHandlers: Record<string, ToolHandler> = {
  list_load_balancers: async (client, args) => {
    const params = schemas.PaginationSchema.parse(args);
    return client.listLoadBalancers(params);
  },

  get_load_balancer: async (client, args) => {
    const { load_balancer_id } = schemas.LoadBalancerIdSchema.parse(args);
    return client.getLoadBalancer(load_balancer_id);
  },

  create_load_balancer: async (client, args) => {
    const params = schemas.CreateLoadBalancerSchema.parse(args);
    return client.createLoadBalancer(params);
  },

  update_load_balancer: async (client, args) => {
    const { load_balancer_id, ...rest } = schemas.UpdateLoadBalancerSchema.parse(args);
    return client.updateLoadBalancer(load_balancer_id, rest);
  },

  delete_load_balancer: async (client, args) => {
    const { load_balancer_id } = schemas.LoadBalancerIdSchema.parse(args);
    await client.deleteLoadBalancer(load_balancer_id);
    return formatSuccess(`Load balancer ${load_balancer_id} deleted`);
  },

  get_load_balancer_availability: async (client, args) => {
    const { region } = schemas.LoadBalancerAvailabilitySchema.parse(args);
    return client.getLoadBalancerAvailability(region);
  },

  add_servers_to_load_balancer: async (client, args) => {
    const { load_balancer_id, server_ids } = schemas.LoadBalancerServersSchema.parse(args);
    await client.addServersToLoadBalancer(load_balancer_id, server_ids);
    return formatSuccess(`Added ${server_ids.length} server(s) to load balancer ${load_balancer_id}`);
  },

  remove_servers_from_load_balancer: async (client, args) => {
    const { load_balancer_id, server_ids } = schemas.LoadBalancerServersSchema.parse(args);
    await client.removeServersFromLoadBalancer(load_balancer_id, server_ids);
    return formatSuccess(`Removed ${server_ids.length} server(s) from load balancer ${load_balancer_id}`);
  },

  add_forwarding_rules: async (client, args) => {
    const { load_balancer_id, forwarding_rules } = schemas.LoadBalancerRulesSchema.parse(args);
    await client.addForwardingRulesToLoadBalancer(load_balancer_id, forwarding_rules);
    return formatSuccess(`Added ${forwarding_rules.length} forwarding rule(s)`);
  },

  remove_forwarding_rules: async (client, args) => {
    const { load_balancer_id, forwarding_rules } = schemas.LoadBalancerRulesSchema.parse(args);
    await client.removeForwardingRulesFromLoadBalancer(load_balancer_id, forwarding_rules);
    return formatSuccess(`Removed ${forwarding_rules.length} forwarding rule(s)`);
  },
};

// ==================== Region & Size Handlers ====================

export const regionSizeHandlers: Record<string, ToolHandler> = {
  list_regions: async (client) => client.listRegions(),

  list_sizes: async (client, args) => {
    const params = schemas.ListSizesSchema.parse(args);
    return client.listSizes(params);
  },
};

// ==================== Action Handlers ====================

export const actionHandlers: Record<string, ToolHandler> = {
  list_actions: async (client, args) => {
    const params = schemas.PaginationSchema.parse(args);
    return client.listActions(params);
  },

  get_action: async (client, args) => {
    const { action_id } = schemas.ActionIdSchema.parse(args);
    return client.getAction(action_id);
  },
};

// ==================== Software Handlers ====================

export const softwareHandlers: Record<string, ToolHandler> = {
  list_software: async (client, args) => {
    const params = schemas.PaginationSchema.parse(args);
    return client.listSoftware(params);
  },

  get_software: async (client, args) => {
    const { software_id } = schemas.SoftwareIdSchema.parse(args);
    return client.getSoftware(software_id);
  },

  list_software_for_os: async (client, args) => {
    const params = schemas.SoftwareForOSSchema.parse(args);
    return client.listSoftwareForOS(params.operating_system_id, params);
  },
};

// ==================== Combined Handler Map ====================

export const allHandlers: Record<string, ToolHandler> = {
  ...accountHandlers,
  ...serverHandlers,
  ...imageHandlers,
  ...sshKeyHandlers,
  ...domainHandlers,
  ...vpcHandlers,
  ...loadBalancerHandlers,
  ...regionSizeHandlers,
  ...actionHandlers,
  ...softwareHandlers,
};
