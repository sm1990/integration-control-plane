#!/bin/bash
# WSO2 Integration Control Plane - Gradle Build Quick Reference

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to print section headers
print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Helper function to print section info
print_info() {
    echo -e "${GREEN}✓${NC} $1"
}

# Helper function for commands
print_command() {
    echo -e "${YELLOW}→${NC} $1"
}

# Function to display help
show_help() {
    print_header "WSO2 ICP - Gradle Build Commands"
    
    echo -e "${BLUE}Quick Start:${NC}"
    echo "  ${YELLOW}./gradlew build${NC}        - Build the project"
    echo "  ${YELLOW}./gradlew run${NC}          - Run the server locally"
    echo "  ${YELLOW}./gradlew test${NC}         - Run tests"
    echo ""
    
    echo -e "${BLUE}Docker Commands:${NC}"
    echo "  ${YELLOW}./gradlew buildDocker${NC}  - Start with Docker"
    echo "  ${YELLOW}./gradlew stopDocker${NC}   - Stop Docker containers"
    echo ""
    
    echo -e "${BLUE}Development:${NC}"
    echo "  gradle -p icp_server dev     - Start dev environment"
    echo "  gradle -p icp_server devDown - Stop dev environment"
    echo ""
    
    echo -e "${BLUE}For full documentation, see GRADLE_BUILD_GUIDE.md${NC}"
}

# Main script logic
case "${1:-help}" in
    build)
        print_header "Building Project"
        print_command "gradle build"
        ./gradlew build
        print_info "Build completed successfully"
        ;;
    
    test)
        print_header "Running Tests"
        print_command "gradle test"
        cd icp_server && gradle test
        print_info "Tests completed"
        ;;
    
    run)
        print_header "Running ICP Server"
        print_command "gradle run"
        ./gradlew run
        ;;
    
    docker)
        print_header "Starting Docker Environment"
        print_command "gradle buildDocker"
        ./gradlew buildDocker
        ;;
    
    docker-stop)
        print_header "Stopping Docker Containers"
        print_command "gradle stopDocker"
        ./gradlew stopDocker
        ;;
    
    dev)
        print_header "Starting Development Environment"
        print_command "gradle -p icp_server dev"
        gradle -p icp_server dev
        ;;
    
    dev-down)
        print_header "Stopping Development Environment"
        print_command "gradle -p icp_server devDown"
        gradle -p icp_server devDown
        ;;
    
    clean)
        print_header "Cleaning Build Artifacts"
        print_command "gradle clean"
        ./gradlew clean
        print_info "Clean completed"
        ;;
    
    format)
        print_header "Formatting Ballerina Code"
        print_command "gradle -p icp_server ballerinaFormat"
        gradle -p icp_server ballerinaFormat
        print_info "Format completed"
        ;;
    
    logs)
        print_header "Docker Logs"
        print_command "gradle -p icp_server dockerLogs"
        gradle -p icp_server dockerLogs
        ;;
    
    help|--help|-h)
        show_help
        ;;
    
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
