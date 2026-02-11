# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-02-11

### Added

- Audit logging for all destructive operations (PR #11)
  - Logs all delete, destroy, and modification operations with timestamps and operation details
  - Enables traceability and compliance tracking for critical operations
- ApiError class for improved error handling (PR #5)
  - Centralized error handling with consistent error messages
  - Better debugging through structured error responses
- Warning logs for empty API response bodies (PR #6)
  - Helps identify potential API issues or unexpected responses
  - Improves debugging of integration issues
- Input sanitization for server names and SSH public keys (PR #3)
  - Validates server names to prevent injection attacks
  - Validates SSH public key formats for security compliance
- Hostname field to HealthCheck for virtual host support (PR #1)
  - Enables proper health checking in virtual host environments
  - Supports more complex load balancer configurations
- Comprehensive documentation with prerequisites, examples, and troubleshooting
  - Complete setup guide with step-by-step instructions
  - Real-world usage examples for common operations
  - Troubleshooting section for common issues
- Repository metadata in package.json
  - GitHub repository URL and homepage
  - Issue tracker configuration
  - Improved package discoverability

### Changed

- Extracted magic numbers to named constants in schemas.ts (PR #10)
  - Improved code maintainability and readability
  - Centralized configuration values for easier updates
- Moved inline schemas to centralized schemas module (PR #9)
  - Better code organization and reusability
  - Single source of truth for validation rules
- Standardized response format across all ~70 handlers (PR #8)
  - Consistent API responses for better client integration
  - Improved developer experience with predictable response structures
- Replaced ServerAction index signature with discriminated union (PR #2)
  - Better type safety through discriminated unions
  - Improved IDE autocomplete and type checking

### Fixed

- Critical: DELETE requests now include request bodies for load balancer operations
  - Resolves issue where DELETE operations were failing due to missing request bodies
  - Ensures proper handling of load balancer deletion workflows
- Remove region parameter from create_load_balancer (LBs are anycast)
  - Corrects API usage to match BinaryLane's anycast load balancer architecture
  - Prevents errors from passing invalid region parameters
- Empty JSON response handling
  - Properly handles API responses with empty bodies
  - Prevents parsing errors and improves error messages
- Null check in query parameter handling to prevent 'null' strings (PR #4)
  - Prevents literal "null" strings from being sent to API
  - Ensures clean query parameter formatting
- ServerAction features field mapping (was incorrectly using enabled_features)
  - Corrects field name to match API specification
  - Fixes feature detection and action availability
- take_backup action: added required replacement_strategy field
  - Ensures backup operations include all required parameters
  - Prevents API errors from missing required fields
- Firewall examples: added explicit deny rules and DNS rule
  - Provides complete firewall configuration examples
  - Demonstrates best practices for security rules

### Security

- Input validation for server names (prevents injection)
  - Protects against command injection and XSS attacks
  - Ensures server names conform to safe character sets
- SSH public key format validation
  - Validates key format before submission to API
  - Prevents malformed keys from causing security issues
  - Ensures keys meet cryptographic standards

[Unreleased]: https://github.com/termau/binarylane-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/termau/binarylane-mcp/releases/tag/v1.0.0
