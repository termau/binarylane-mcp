# BinaryLane MCP Server

A Model Context Protocol (MCP) server for interacting with the [BinaryLane](https://www.binarylane.com.au/) VPS hosting API.

## Features

- **Comprehensive API Coverage**: 70+ tools covering all BinaryLane API endpoints
- **Input Validation**: Zod schema validation with descriptive error messages
- **Tool Annotations**: Proper hints for read-only, destructive, and idempotent operations
- **Actionable Errors**: Clear error messages with suggestions for resolution
- **Well-Documented**: Every tool includes detailed descriptions with examples

## Installation

```bash
npm install
npm run build
```

## Configuration

Set your BinaryLane API token as an environment variable:

```bash
export BINARYLANE_API_TOKEN="your-api-token-here"
```

Get your API token from: https://home.binarylane.com.au/api-info

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "binarylane": {
      "command": "node",
      "args": ["/path/to/bl-mcp/dist/index.js"],
      "env": {
        "BINARYLANE_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

### Standalone

```bash
npm start
```

## Available Tools

### Account Management
- `get_account` - Get account information
- `get_balance` - Get current balance and usage
- `list_invoices` - List all invoices
- `get_invoice` - Get specific invoice details
- `get_unpaid_invoices` - Get unpaid failed invoices
- `proceed_action` - Respond to pending actions

### Server Management
- `list_servers` - List all VPS servers
- `get_server` - Get server details
- `create_server` - Create a new server
- `delete_server` - Cancel/delete a server
- `server_action` - Perform server actions (power, backup, resize, etc.)
- `list_server_actions` - List server action history
- `get_server_action` - Get specific action status
- `get_server_backups` - List server backups
- `get_server_snapshots` - List server snapshots
- `upload_backup` - Upload external backup
- `get_server_firewall` - Get firewall rules
- `get_server_console` - Get VNC console access
- `get_data_usage` - Get data transfer usage
- `list_all_data_usage` - List usage for all servers
- `get_server_kernels` - List available kernels
- `get_server_features` - Get available features
- `get_server_threshold_alerts` - Get resource alerts
- `list_exceeded_alerts` - List servers with exceeded alerts
- `get_server_software` - Get installed software
- `get_server_user_data` - Get cloud-init data
- `get_server_metrics` - Get performance metrics
- `get_server_latest_metrics` - Get latest metrics

#### Important: Port Blocking

New servers have **outbound port blocking enabled by default**, which blocks common spam/attack ports. This will prevent:
- HTTPS outbound connections (apt, wget, curl over HTTPS)
- DNS resolution in some cases
- SSL certificate renewal (certbot, Let's Encrypt)

If your server needs outbound connectivity, set `port_blocking: false` during creation or use the `change_port_blocking` server action.

### Image Management
- `list_images` - List OS images and backups
- `get_image` - Get image details
- `delete_image` - Delete backup image
- `update_image` - Update image metadata
- `get_image_download` - Get download URL

### SSH Key Management
- `list_ssh_keys` - List SSH keys
- `get_ssh_key` - Get SSH key details
- `create_ssh_key` - Add new SSH key
- `update_ssh_key` - Update SSH key
- `delete_ssh_key` - Delete SSH key

### Domain Management
- `list_domains` - List DNS domains
- `get_domain` - Get domain details
- `create_domain` - Add new domain
- `delete_domain` - Remove domain
- `list_domain_records` - List DNS records
- `get_domain_record` - Get record details
- `create_domain_record` - Create DNS record
- `update_domain_record` - Update DNS record
- `delete_domain_record` - Delete DNS record
- `list_nameservers` - List BinaryLane nameservers
- `refresh_nameserver_cache` - Refresh DNS cache
- `list_ipv6_reverse_names` - List IPv6 PTR records
- `update_ipv6_reverse` - Update IPv6 PTR record

#### DNS Management Notes

**TTL Constraints:** BinaryLane DNS supports a TTL range of 3600-86400 seconds (1-24 hours), with 3600 seconds (1 hour) as the standard and default value. The minimum TTL is 3600 seconds.

### VPC Management
- `list_vpcs` - List VPCs
- `get_vpc` - Get VPC details
- `create_vpc` - Create new VPC
- `update_vpc` - Update VPC settings
- `delete_vpc` - Delete VPC
- `get_vpc_members` - List VPC members

### Load Balancer Management
- `list_load_balancers` - List load balancers
- `get_load_balancer` - Get load balancer details
- `create_load_balancer` - Create load balancer
- `update_load_balancer` - Update load balancer
- `delete_load_balancer` - Delete load balancer
- `get_load_balancer_availability` - Check availability/pricing
- `add_servers_to_load_balancer` - Add backend servers
- `remove_servers_from_load_balancer` - Remove backend servers
- `add_forwarding_rules` - Add forwarding rules
- `remove_forwarding_rules` - Remove forwarding rules

#### Load Balancer Setup Requirements

BinaryLane load balancers are **anycast** and regionless. After creating a load balancer:

1. **Do NOT specify a region parameter** when creating (causes IP allocation errors)
2. **Each backend server MUST have the LB's anycast IP configured on its loopback interface:**
   ```bash
   ip addr add <LB_IP>/32 dev lo
   ```
3. **Persist the VIP** with netplan (create `/etc/netplan/60-lb-loopback.yaml`):
   ```yaml
   network:
     version: 2
     ethernets:
       lo:
         addresses:
           - <LB_IP>/32
   ```
4. **Health check hostname** defaults to the LB name. If backends use server_name matching, update the health check hostname to your actual domain.

Without the loopback VIP, health checks will fail and traffic will not be forwarded.

### Infrastructure Info
- `list_regions` - List available regions
- `list_sizes` - List server sizes and pricing
- `list_actions` - List recent actions
- `get_action` - Get action details

### Software
- `list_software` - List available software
- `get_software` - Get software details
- `list_software_for_os` - List software for specific OS

## Server Actions

The `server_action` tool supports many action types:

**Power Actions**: power_on, power_off, reboot, shutdown, power_cycle

**Status Checks**: ping, uptime, is_running

**Backup Actions**: take_backup, restore, enable_backups, disable_backups, attach_backup, detach_backup, clone_using_backup

**Configuration**: rebuild, resize, rename, change_region, change_kernel

**Network**: enable_ipv6, change_ipv6, change_port_blocking, change_network, change_vpc_ipv4, change_reverse_name

**Disk Operations**: add_disk, resize_disk, delete_disk

**Advanced**: change_advanced_features, change_advanced_firewall_rules, change_threshold_alerts

### Advanced Firewall Rules

BinaryLane firewalls are **STATELESS** with **NO implicit deny**. Critical requirements:

- Rules are evaluated **in order** (first match wins)
- **MUST include explicit DROP rules** at the end or all traffic is allowed
- **MUST allow UDP 53 (DNS) before any UDP DROP** or servers cannot resolve hostnames
- DB-only servers **still need HTTP/HTTPS rules** for apt to work
- Web servers need **TCP 3306 ACCEPT** for MySQL return traffic (stateless)

**Example:** SSH, HTTP, HTTPS, DNS, ICMP allowed, all else blocked:
```json
[
  {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "destination_ports": ["22"], "protocol": "tcp", "action": "accept"},
  {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "destination_ports": ["80"], "protocol": "tcp", "action": "accept"},
  {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "destination_ports": ["443"], "protocol": "tcp", "action": "accept"},
  {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "protocol": "icmp", "action": "accept"},
  {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "destination_ports": ["53"], "protocol": "udp", "action": "accept"},
  {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "protocol": "tcp", "action": "drop"},
  {"source_addresses": ["0.0.0.0/0"], "destination_addresses": ["0.0.0.0/0"], "protocol": "udp", "action": "drop"}
]
```

## Development

```bash
# Build
npm run build

# Watch mode (development)
npm run dev
```

## Project Structure

```
bl-mcp/
├── src/
│   ├── index.ts        # Main entry point
│   ├── api-client.ts   # BinaryLane API client
│   ├── tools.ts        # Tool definitions with annotations
│   ├── handlers.ts     # Tool handler implementations
│   └── schemas.ts      # Zod validation schemas
├── dist/               # Compiled JavaScript
├── package.json
└── tsconfig.json
```

## API Reference

For detailed API documentation, see: https://api.binarylane.com.au/reference/

## License

MIT
