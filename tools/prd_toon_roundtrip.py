#!/usr/bin/env python3
"""Shim for the prd_toon package."""

import sys
import os

# Ensure the tools directory is in the path so we can import the package
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from prd_toon.cli import main
except ImportError:
    # Fallback for when run from repo root
    sys.path.insert(0, os.path.join(os.getcwd(), "tools"))
    from prd_toon.cli import main

if __name__ == "__main__":
    sys.exit(main())
