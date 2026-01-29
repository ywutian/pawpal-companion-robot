.DEFAULT_GOAL := help
# PlatformIO environments share a build directory; never run their jobs together.
.NOTPARALLEL:

NODE ?= node
PYTHON ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3)
PIO ?= $(if $(wildcard .venv/bin/pio),.venv/bin/pio,pio)
PORT ?= 8080
QA_URL ?=

.PHONY: help serve test test-js test-python test-native build qa verify

help: ## Show available developer commands
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

serve: ## Serve the browser demo on loopback only
	PYTHONPATH=supervisor/src PAWPAL_NODE=$(NODE) $(PYTHON) -m pawpal_supervisor.web_server --port $(PORT)

test: test-js test-python test-native ## Run all unit tests without hardware

test-js: ## Test browser state, protocol, and demo lifecycle
	$(NODE) --test simulator/*.test.mjs

test-python: ## Test the Raspberry Pi supervisor
	PYTHONPATH=supervisor/src $(PYTHON) -m unittest discover -s supervisor/tests -v

test-native: ## Test firmware behavior on the host
	$(PIO) test -d firmware -e native

build: ## Compile ESP32-S3 firmware without flashing
	$(PIO) run -d firmware -e esp32-s3-devkitc-1

qa: ## Start an isolated Python service and run browser QA (requires Playwright)
	PAWPAL_PYTHON=$(PYTHON) PAWPAL_NODE=$(NODE) $(NODE) simulator/qa.mjs $(QA_URL)

verify: test build qa ## Run every check, including an isolated end-to-end service
