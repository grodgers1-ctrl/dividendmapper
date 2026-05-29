import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("jsdom + RTL setup", () => {
  it("renders a component and asserts via jest-dom matcher", () => {
    render(<button type="button">click me</button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });
});
