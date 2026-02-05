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
