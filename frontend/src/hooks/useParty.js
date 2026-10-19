import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "./useSocket";
import { canRetryStart } from "../utils/commandRetry";

export function useParty(code) {
  const { socket, connected } = useSocket();
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingCommand, setPendingCommand] = useState(null);
  const [offset, setOffset] = useState(0);
  const latest = useRef(null);
  const busy = useRef(false);
  const navigate = useNavigate();
  const accept = useCallback(
    (data) => {
      if (
        data.room.code !== code ||
        (latest.current && data.room.revision < latest.current.room.revision)
      )
        return;
      latest.current = data;
      setSnapshot(data);
      setOffset(data.serverNow - Date.now());
    },
    [code],
  );
  const sync = useCallback(
    (clearError = true) => {
      if (!socket?.connected) return;
      socket.timeout(10000).emit("party:sync", code, (err, reply) => {
        if (err) {
          setError("ยังติดต่อวงไม่ได้ ลองเชื่อมต่ออีกครั้ง");
          return;
        }
        if (!reply?.ok) {
          setError(reply?.error || "เข้าวงไม่สำเร็จ");
          return;
        }
        accept(reply.snapshot);
        if (clearError !== false) setError("");
      });
    },
    [socket, code, accept],
  );
  useEffect(() => {
    latest.current = null;
    setSnapshot(null);
    if (!socket) return;
    socket.on("party:state", accept);
    socket.on("connect", sync);
    const left = () => navigate("/", { replace: true });
    socket.on("party:left", left);
    const visible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", sync);
    sync();
    return () => {
      socket.off("party:state", accept);
      socket.off("connect", sync);
      socket.off("party:left", left);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", sync);
    };
  }, [socket, accept, sync, navigate]);
  const command = useCallback(
    async (type, payload = {}) => {
      if (!socket?.connected || busy.current || !latest.current) return;
      busy.current = true;
      setPending(true);
      setPendingCommand(type);
      setError("");
      return new Promise((resolve) => {
        const before = latest.current;
        const envelope = {
          code,
          type,
          commandId: crypto.randomUUID(),
          expectedRevision: latest.current.room.revision,
          roundId: latest.current.state.round?.id,
          ...payload,
        };
        const finish = (err, reply) => {
          busy.current = false;
          setPending(false);
          setPendingCommand(null);
          if (err || !reply?.ok) {
            setError(reply?.error || "ยังไม่ยืนยันคำสั่ง กำลังตรวจสถานะล่าสุด");
            sync(false);
            resolve(false);
            return;
          }
          accept(reply.snapshot);
          resolve(true);
        };
        const send = (retried = false) =>
          socket
            .timeout(10000)
            .emit("party:command", envelope, (err, reply) => {
              if (
                !err &&
                reply?.code === "STALE_STATE" &&
                !retried &&
                canRetryStart(type, before, latest.current)
              ) {
                socket
                  .timeout(10000)
                  .emit("party:sync", code, (syncError, synced) => {
                    if (syncError || !synced?.ok) {
                      finish(syncError, synced);
                      return;
                    }
                    accept(synced.snapshot);
                    if (!canRetryStart(type, before, latest.current)) {
                      finish(null, reply);
                      return;
                    }
                    envelope.expectedRevision = latest.current.room.revision;
                    send(true);
                  });
              } else finish(err, reply);
            });
        send();
      });
    },
    [socket, code, accept, sync],
  );
  const leave = useCallback(() => {
    if (!socket?.connected) {
      navigate("/");
      return;
    }
    socket.timeout(8000).emit("party:leave", code, (err, reply) => {
      if (err || !reply?.ok)
        setError(reply?.error || "ออกจากวงไม่สำเร็จ ลองอีกครั้ง");
      else navigate("/");
    });
  }, [socket, code, navigate]);
  return {
    snapshot,
    command,
    connected,
    pending,
    pendingCommand,
    error,
    setError,
    sync,
    leave,
    offset,
  };
}
