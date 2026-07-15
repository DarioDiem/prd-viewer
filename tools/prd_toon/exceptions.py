"""Custom exceptions for the prd_toon package."""

class RoundTripError(Exception):
    """A recoverable per-file round-trip failure."""

class ToonCLIError(RoundTripError):
    """An error occurred when running the TOON CLI."""
