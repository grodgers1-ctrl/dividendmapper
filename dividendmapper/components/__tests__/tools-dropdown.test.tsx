import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolsDropdown, TOOL_LINKS } from "../tools-dropdown";

describe("<ToolsDropdown>", () => {
  it("renders a Tools trigger button", () => {
    render(<ToolsDropdown />);
    expect(screen.getByRole("button", { name: /tools/i })).toBeInTheDocument();
  });

  it("hides tool links until the trigger is opened", () => {
    render(<ToolsDropdown />);
    expect(screen.queryByRole("link", { name: /retirement calculator/i })).not.toBeInTheDocument();
  });

  it("reveals every TOOL_LINKS entry when opened", async () => {
    const user = userEvent.setup();
    render(<ToolsDropdown />);
    await user.click(screen.getByRole("button", { name: /tools/i }));
    for (const link of TOOL_LINKS) {
      const el = screen.getByRole("menuitem", { name: link.label });
      expect(el).toHaveAttribute("href", link.href);
    }
  });

  it("opens on ArrowDown from the trigger", async () => {
    const user = userEvent.setup();
    render(<ToolsDropdown />);
    const trigger = screen.getByRole("button", { name: /tools/i });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /retirement calculator/i })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<ToolsDropdown />);
    await user.click(screen.getByRole("button", { name: /tools/i }));
    expect(screen.getByRole("menuitem", { name: /retirement calculator/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem", { name: /retirement calculator/i })).not.toBeInTheDocument();
  });

  it("sets aria-expanded reflecting open state", async () => {
    const user = userEvent.setup();
    render(<ToolsDropdown />);
    const trigger = screen.getByRole("button", { name: /tools/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
