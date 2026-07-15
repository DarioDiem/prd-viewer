import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverMock,
  writable: true
});

Element.prototype.scrollIntoView = vi.fn();

Object.defineProperty(URL, "createObjectURL", {
  value: vi.fn(() => "blob:trace-summary"),
  writable: true
});

Object.defineProperty(URL, "revokeObjectURL", {
  value: vi.fn(),
  writable: true
});

Object.defineProperty(globalThis, "fetch", {
  value: vi.fn(async () => new Response("", { status: 404 })),
  writable: true
});

HTMLAnchorElement.prototype.click = vi.fn();
