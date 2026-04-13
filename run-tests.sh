#!/bin/bash

# Crucible Playwright Test Runner
# Convenient script for running tests for different Crucible applications

set -e

# Load service URLs from .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

# Resolve infrastructure URLs (with defaults)
KEYCLOAK_URL="${KEYCLOAK_URL:-https://localhost:8443}"
ASPIRE_DASHBOARD_URL="${ASPIRE_DASHBOARD_URL:-https://localhost:17088}"

# All supported apps
ALL_APPS="keycloak blueprint player cite gameboard topomojo steamfitter moodle alloy caster gallery"

# Map app name to its UI URL from .env
get_app_url() {
    local app="$1"
    case "$app" in
        keycloak)    echo "${KEYCLOAK_URL}";;
        blueprint)   echo "${BLUEPRINT_UI_URL:-http://localhost:4725}";;
        player)      echo "${PLAYER_UI_URL:-http://localhost:4301}";;
        cite)        echo "${CITE_UI_URL:-http://localhost:4721}";;
        gameboard)   echo "${GAMEBOARD_UI_URL:-http://localhost:4202}";;
        topomojo)    echo "${TOPOMOJO_UI_URL:-http://localhost:4201}";;
        steamfitter) echo "${STEAMFITTER_UI_URL:-http://localhost:4401}";;
        moodle)      echo "${MOODLE_URL:-http://localhost:8081}";;
        alloy)       echo "${ALLOY_UI_URL:-http://localhost:4403}";;
        caster)      echo "${CASTER_UI_URL:-http://localhost:4310}";;
        gallery)     echo "${GALLERY_UI_URL:-http://localhost:4723}";;
        *) echo "";;
    esac
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}=========================================="
    echo -e "$1"
    echo -e "==========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if services are running
# Usage: check_services [app ...]
# With no args, checks Keycloak + Aspire only.
# With app names, also checks each app's UI URL.
check_services() {
    echo -e "${BLUE}Checking required services...${NC}"

    local all_ok=true

    # Keycloak is always required (handles auth for all apps)
    if curl -k -s "$KEYCLOAK_URL" > /dev/null 2>&1; then
        print_success "Keycloak ($KEYCLOAK_URL)"
    else
        print_error "Keycloak not accessible at $KEYCLOAK_URL"
        all_ok=false
    fi

    # Aspire dashboard is optional
    if curl -k -s "$ASPIRE_DASHBOARD_URL" > /dev/null 2>&1; then
        print_success "Aspire Dashboard ($ASPIRE_DASHBOARD_URL)"
    else
        print_warning "Aspire Dashboard not accessible (optional)"
    fi

    # Check each requested app
    for app in "$@"; do
        [ "$app" = "keycloak" ] && continue  # already checked above
        local url
        url=$(get_app_url "$app")
        if [ -z "$url" ]; then
            print_warning "Unknown app: $app (skipping health check)"
            continue
        fi
        local curl_flags="-s"
        [[ "$url" == https://* ]] && curl_flags="-k -s"
        if curl $curl_flags "$url" > /dev/null 2>&1; then
            print_success "$app ($url)"
        else
            print_error "$app not accessible at $url"
            all_ok=false
        fi
    done

    echo ""

    if [ "$all_ok" = false ]; then
        print_error "Required services are not running!"
        echo ""
        echo "Please start Aspire services:"
        echo "  cd /workspaces/crucible-development/Crucible.AppHost && dotnet run"
        echo ""
        exit 1
    fi
}

# Show usage
show_usage() {
    cat << EOF
Crucible Playwright Test Runner

Usage: $0 [app|command] [options]

Applications:
  keycloak               Run Keycloak (Identity Provider) tests
  blueprint              Run Blueprint tests
  player                 Run Player tests
  cite                   Run CITE tests
  gameboard              Run Gameboard tests
  topomojo               Run TopoMojo tests
  steamfitter            Run Steamfitter tests
  moodle                 Run Moodle tests
  alloy                  Run Alloy tests
  caster                 Run Caster tests
  gallery                Run Gallery tests

Commands:
  all                    Run all tests for all apps
  quick                  Run quick smoke tests
  ui [app]               Run tests in UI mode (optionally for specific app)
  headed [app]           Run tests in headed mode (optionally for specific app)
  debug [app]            Run tests in debug mode (optionally for specific app)
  report                 Show test report
  help                   Show this help message

Options:
  --no-check            Skip service health checks
  --filter <pattern>    Filter tests by pattern
  --app <app>           Run tests for specific app

Examples:
  $0 all                # Run all tests for all apps
  $0 blueprint          # Run all Blueprint tests
  $0 quick --app blueprint  # Run Blueprint smoke tests
  $0 ui blueprint       # Run Blueprint tests in UI mode
  $0 --filter login --app player  # Run Player tests matching 'login'

EOF
}

# Parse arguments
COMMAND=${1:-help}
APP=""
NO_CHECK=false
FILTER=""

shift 2>/dev/null || true

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-check)
            NO_CHECK=true
            shift
            ;;
        --filter)
            FILTER="$2"
            shift 2
            ;;
        --app)
            APP="$2"
            shift 2
            ;;
        *)
            # Check if it's a known app name
            if echo "$ALL_APPS" | grep -qw "$1"; then
                APP="$1"
                shift
            else
                echo "Unknown option: $1"
                show_usage
                exit 1
            fi
            ;;
    esac
done

# Determine which app(s) to health-check
TARGET_APP=""
if [ -n "$APP" ]; then
    TARGET_APP="$APP"
elif echo "$ALL_APPS" | grep -qw "$COMMAND"; then
    TARGET_APP="$COMMAND"
fi

# Check services unless --no-check is specified
if [ "$NO_CHECK" = false ] && [ "$COMMAND" != "help" ] && [ "$COMMAND" != "report" ]; then
    if [ -n "$TARGET_APP" ]; then
        check_services "$TARGET_APP"
    else
        # Running all apps or no specific app - just check infrastructure
        check_services
    fi
fi

# Execute command
case $COMMAND in
    all)
        print_header "Running All Tests"
        if [ -n "$APP" ]; then
            print_warning "Running tests for app: $APP"
            if [ -n "$FILTER" ]; then
                npx playwright test "$APP/" --grep "$FILTER"
            else
                npx playwright test "$APP/"
            fi
        else
            if [ -n "$FILTER" ]; then
                npx playwright test --grep "$FILTER"
            else
                npx playwright test
            fi
        fi
        ;;

    quick)
        print_header "Running Quick Smoke Tests"
        if [ -n "$APP" ]; then
            print_warning "Running smoke tests for: $APP"
            npx playwright test "$APP/tests/" --grep "login|home"
        else
            print_warning "Running smoke tests for all apps"
            npx playwright test --grep "login|home"
        fi
        print_success "Smoke tests complete!"
        ;;

    ui)
        print_header "Running Tests in UI Mode"
        TEST_PATH=""
        if [ -n "$APP" ]; then
            TEST_PATH="$APP/"
            print_warning "Running UI tests for: $APP"
        fi
        if [ -n "$FILTER" ]; then
            npx playwright test "$TEST_PATH" --ui --grep "$FILTER"
        else
            npx playwright test "$TEST_PATH" --ui
        fi
        ;;

    headed)
        print_header "Running Tests in Headed Mode"
        TEST_PATH=""
        if [ -n "$APP" ]; then
            TEST_PATH="$APP/"
            print_warning "Running headed tests for: $APP"
        fi
        if [ -n "$FILTER" ]; then
            npx playwright test "$TEST_PATH" --headed --grep "$FILTER"
        else
            npx playwright test "$TEST_PATH" --headed
        fi
        ;;

    debug)
        print_header "Running Tests in Debug Mode"
        TEST_PATH=""
        if [ -n "$APP" ]; then
            TEST_PATH="$APP/"
            print_warning "Running debug tests for: $APP"
        fi
        if [ -n "$FILTER" ]; then
            npx playwright test "$TEST_PATH" --debug --grep "$FILTER"
        else
            npx playwright test "$TEST_PATH" --debug
        fi
        ;;

    report)
        print_header "Opening Test Report"
        npx playwright show-report
        ;;

    help|--help|-h)
        show_usage
        ;;

    *)
        # Check if the command is a known app name
        if echo "$ALL_APPS" | grep -qw "$COMMAND"; then
            print_header "Running $COMMAND Tests"
            if [ -n "$FILTER" ]; then
                npx playwright test "$COMMAND/" --grep "$FILTER"
            else
                npx playwright test "$COMMAND/"
            fi
        else
            echo -e "${RED}Unknown command: $COMMAND${NC}"
            echo ""
            show_usage
            exit 1
        fi
        ;;
esac

echo ""
print_success "Done!"
