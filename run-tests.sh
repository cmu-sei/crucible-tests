#!/bin/bash

# Crucible Playwright Test Runner
# Convenient script for running tests for different Crucible applications

set -e

# Load service URLs from the appropriate env file.
#
# CRUCIBLE_TARGET (aspire|minikube) selects between deployment topologies:
#   - aspire   : each app on its own localhost:<port> (default)
#   - minikube : single ingress host (https://crucible/<app>)
#
# When unset, .env is sourced (back-compat with the original setup).
# A `--target <name>` flag (parsed below) overrides the environment variable.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pre-scan for --target so the env file is loaded before anything else.
for ((i=1; i<=$#; i++)); do
    if [ "${!i}" = "--target" ]; then
        next=$((i+1))
        export CRUCIBLE_TARGET="${!next}"
        break
    fi
done

load_target_env() {
    local file
    if [ -n "$CRUCIBLE_TARGET" ]; then
        file="$SCRIPT_DIR/.env.${CRUCIBLE_TARGET}"
        if [ ! -f "$file" ]; then
            echo "Error: CRUCIBLE_TARGET=${CRUCIBLE_TARGET} but ${file} does not exist." >&2
            exit 1
        fi
    else
        file="$SCRIPT_DIR/.env"
    fi
    if [ -f "$file" ]; then
        set -a
        # shellcheck disable=SC1090
        source "$file"
        set +a
    fi
    # Optional per-user override file, always loaded last.
    if [ -f "$SCRIPT_DIR/.env.local" ]; then
        set -a
        # shellcheck disable=SC1091
        source "$SCRIPT_DIR/.env.local"
        set +a
    fi
}
# All supported apps
ALL_APPS="keycloak blueprint player cite gameboard topomojo steamfitter moodle alloy caster gallery"

# Map app name to apps it depends on (space-separated)
get_app_deps() {
    local app="$1"
    case "$app" in
        gameboard) echo "topomojo";;
        *) echo "";;
    esac
}

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

    # Aspire dashboard is optional and only relevant under the aspire target
    if [ -n "$ASPIRE_DASHBOARD_URL" ]; then
        if curl -k -s "$ASPIRE_DASHBOARD_URL" > /dev/null 2>&1; then
            print_success "Aspire Dashboard ($ASPIRE_DASHBOARD_URL)"
        else
            print_warning "Aspire Dashboard not accessible (optional)"
        fi
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
  -h, --help             Show this help message and exit
  --no-check            Skip service health checks
  --verbose, -v         Echo each test's stdout/stderr to the terminal too.
                        By default that output goes only to the .logs/ file,
                        keeping the live progress display readable.
  --filter <pattern>    Filter tests by pattern
  --app <app>           Run tests for specific app
  --browser <name>      Run tests in a single browser: chromium | firefox.
                        When omitted, tests run in both browsers (default).
  --workers <n>         Number of parallel workers (passed to Playwright).
                        Accepts a count (e.g. 4) or a percentage (e.g. 50%).
                        When omitted, the playwright.config.ts default is used.
  --target <name>       Deployment target: aspire (default) | minikube.
                        Selects which .env.<name> file to load. Can also be
                        set via the CRUCIBLE_TARGET environment variable.

Examples:
  $0 all                # Run all tests for all apps
  $0 blueprint          # Run all Blueprint tests
  $0 quick --app blueprint  # Run Blueprint smoke tests
  $0 ui blueprint       # Run Blueprint tests in UI mode
  $0 --filter login --app player  # Run Player tests matching 'login'
  $0 blueprint --target minikube  # Run Blueprint tests against a minikube deployment
  $0 all --browser chromium  # Run all tests in chromium only
  $0 all --workers 4         # Run all tests with 4 parallel workers

EOF
}

# Parse arguments
COMMAND=${1:-help}
APP=""
NO_CHECK=false
FILTER=""
BROWSER=""
WORKERS=""
VERBOSE=false
SHOW_HELP=false

case "$COMMAND" in
    -h|--help)
        SHOW_HELP=true
        ;;
esac

shift 2>/dev/null || true

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            SHOW_HELP=true
            shift
            ;;
        --no-check)
            NO_CHECK=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
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
        --browser)
            case "$2" in
                chromium|firefox)
                    BROWSER="$2"
                    ;;
                *)
                    print_error "Invalid --browser value: '$2' (valid values: chromium, firefox)"
                    exit 1
                    ;;
            esac
            shift 2
            ;;
        --workers)
            if ! [[ "$2" =~ ^[0-9]+%?$ ]]; then
                print_error "Invalid --workers value: '$2' (expected a count like 4 or a percentage like 50%)"
                exit 1
            fi
            WORKERS="$2"
            shift 2
            ;;
        --target)
            # Already consumed by the pre-scan above; just skip the value.
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

if [ "$SHOW_HELP" = true ]; then
    show_usage
    exit 0
fi

load_target_env

# Resolve infrastructure URLs (with defaults)
KEYCLOAK_URL="${KEYCLOAK_URL:-https://localhost:8443}"
ASPIRE_DASHBOARD_URL="${ASPIRE_DASHBOARD_URL:-https://localhost:17088}"

# Determine which app(s) to health-check
TARGET_APP=""
if [ -n "$APP" ]; then
    TARGET_APP="$APP"
elif echo "$ALL_APPS" | grep -qw "$COMMAND"; then
    TARGET_APP="$COMMAND"
fi

# In verbose mode the progress-bar reporter echoes each test's stdout/stderr to
# the terminal as well as the log. By default that output goes only to the log,
# keeping the live terminal readable.
if [ "$VERBOSE" = true ]; then
    export CRUCIBLE_VERBOSE=1
fi

# Set up logging: capture the full output of this run (stdout + stderr, the
# service health check, and all Playwright output) to a timestamped file under
# .logs/ so past runs can be reviewed in full. Skipped for non-runs (help,
# report) and the interactive GUI modes (ui, debug) which have no useful log.
case "$COMMAND" in
    help|--help|-h|report|ui|debug)
        ;;
    *)
        LOG_DIR="$SCRIPT_DIR/.logs"
        mkdir -p "$LOG_DIR"
        LOG_FILE="$LOG_DIR/$(date +%Y%m%d-%H%M%S)-${COMMAND}${APP:+-$APP}.log"
        # Redirect this script's own output (health check, headers, summary)
        # through tee so it lands in both the terminal and the log file.
        exec > >(tee -a "$LOG_FILE") 2>&1
        echo -e "${BLUE}Logging full output to: $LOG_FILE${NC}"
        echo ""
        # The progress-bar reporter owns the Playwright test output: it paints
        # colored lines + a bottom-pinned bar to /dev/tty (kept off this tee pipe,
        # so it never pollutes the log) and appends a clean plain-text copy of each
        # line to the same log file via CRUCIBLE_LOG_FILE.
        export CRUCIBLE_LOG_FILE="$LOG_FILE"
        ;;
esac

# Check services unless --no-check is specified
if [ "$NO_CHECK" = false ] && [ "$COMMAND" != "help" ] && [ "$COMMAND" != "report" ]; then
    if [ -n "$TARGET_APP" ]; then
        check_services "$TARGET_APP" $(get_app_deps "$TARGET_APP")
    else
        # Running all apps or no specific app - just check infrastructure
        check_services
    fi
fi

# Build the Playwright --project argument from --browser (empty = run all browsers).
# The project names map to those defined in playwright.config.ts.
BROWSER_ARG=""
if [ -n "$BROWSER" ]; then
    BROWSER_ARG="--project $BROWSER"
fi

# Build the Playwright --workers argument (empty = use the config default).
WORKERS_ARG=""
if [ -n "$WORKERS" ]; then
    WORKERS_ARG="--workers $WORKERS"
fi

# Execute command
case $COMMAND in
    all)
        print_header "Running All Tests"
        if [ -n "$APP" ]; then
            print_warning "Running tests for app: $APP"
            if [ -n "$FILTER" ]; then
                npx playwright test "$APP/tests/" $BROWSER_ARG $WORKERS_ARG --grep "$FILTER"
            else
                npx playwright test "$APP/tests/" $BROWSER_ARG $WORKERS_ARG
            fi
        else
            if [ -n "$FILTER" ]; then
                npx playwright test $BROWSER_ARG $WORKERS_ARG --grep "$FILTER"
            else
                npx playwright test $BROWSER_ARG $WORKERS_ARG
            fi
        fi
        ;;

    quick)
        print_header "Running Quick Smoke Tests"
        if [ -n "$APP" ]; then
            print_warning "Running smoke tests for: $APP"
            npx playwright test "$APP/tests/" $BROWSER_ARG $WORKERS_ARG --grep "login|home"
        else
            print_warning "Running smoke tests for all apps"
            npx playwright test $BROWSER_ARG $WORKERS_ARG --grep "login|home"
        fi
        print_success "Smoke tests complete!"
        ;;

    ui)
        print_header "Running Tests in UI Mode"
        TEST_PATH=""
        if [ -n "$APP" ]; then
            TEST_PATH="$APP/tests/"
            print_warning "Running UI tests for: $APP"
        fi
        if [ -n "$FILTER" ]; then
            npx playwright test "$TEST_PATH" $BROWSER_ARG --ui --grep "$FILTER"
        else
            npx playwright test "$TEST_PATH" $BROWSER_ARG --ui
        fi
        ;;

    headed)
        print_header "Running Tests in Headed Mode"
        TEST_PATH=""
        if [ -n "$APP" ]; then
            TEST_PATH="$APP/tests/"
            print_warning "Running headed tests for: $APP"
        fi
        if [ -n "$FILTER" ]; then
            npx playwright test "$TEST_PATH" $BROWSER_ARG $WORKERS_ARG --headed --grep "$FILTER"
        else
            npx playwright test "$TEST_PATH" $BROWSER_ARG $WORKERS_ARG --headed
        fi
        ;;

    debug)
        print_header "Running Tests in Debug Mode"
        TEST_PATH=""
        if [ -n "$APP" ]; then
            TEST_PATH="$APP/tests/"
            print_warning "Running debug tests for: $APP"
        fi
        if [ -n "$FILTER" ]; then
            npx playwright test "$TEST_PATH" $BROWSER_ARG --debug --grep "$FILTER"
        else
            npx playwright test "$TEST_PATH" $BROWSER_ARG --debug
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
                npx playwright test "$COMMAND/tests/" $BROWSER_ARG $WORKERS_ARG --grep "$FILTER"
            else
                npx playwright test "$COMMAND/tests/" $BROWSER_ARG $WORKERS_ARG
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
