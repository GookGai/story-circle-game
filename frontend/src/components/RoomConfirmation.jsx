import { useEffect, useId, useRef } from "react";
import Icon from "./PartyIcon";

export default function RoomConfirmation({
  title,
  description,
  actionLabel,
  onConfirm,
  onCancel,
  disabled,
  busy,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const modal = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    modal.current?.querySelector("[data-cancel]")?.focus();
    function keys(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (current.getAttribute("aria-busy") !== "true") onCancel();
      }
      if (event.key !== "Tab") return;
      const buttons = [
        ...modal.current.querySelectorAll("button:not(:disabled)"),
      ];
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    const current = modal.current;
    current.addEventListener("keydown", keys);
    return () => {
      current.removeEventListener("keydown", keys);
      if (previous?.isConnected) previous.focus();
    };
  }, [onCancel]);
  return (
    <div className="party-modal-backdrop">
      <section
        ref={modal}
        className="party-modal room-confirmation"
        role="dialog"
        aria-modal="true"
        aria-busy={!!busy}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <Icon name="pause" size={32} />
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <button
          className="p-button outline full"
          data-cancel
          disabled={busy}
          onClick={onCancel}
        >
          กลับไปเล่นต่อ
        </button>
        <button
          className="p-button primary full"
          disabled={disabled}
          onClick={onConfirm}
        >
          {busy ? "กำลังยืนยัน…" : actionLabel}
        </button>
      </section>
    </div>
  );
}
