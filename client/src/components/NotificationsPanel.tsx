import { Bell, CheckCheck, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

type Props = { open: boolean; onClose: () => void };

export function NotificationsPanel({ open, onClose }: Props) {
  const { notifications, markNotificationRead, markAllNotificationsRead, unreadCount } = useAuth();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Notifications">
      <button aria-label="Close notifications" onClick={onClose} className="absolute inset-0 bg-[#172017]/25 backdrop-blur-[1px]" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-[#e2e6dc] bg-[#fbfcf8] shadow-2xl dark:border-[#2c3c2d] dark:bg-[#142016]">
        <div className="flex items-center justify-between border-b border-[#e6e9e2] px-5 py-5 dark:border-[#2c3c2d]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf7cf] text-[#638f25] dark:bg-[#263b1d] dark:text-[#b8f34a]"><Bell size={18} /></div>
            <div><h2 className="font-display text-lg font-extrabold tracking-[-0.04em]">Notifications</h2><p className="text-[11px] text-[#899087]">{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</p></div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-[#788075] hover:bg-[#edf0e8]"><X size={18} /></button>
        </div>
        {notifications.length > 0 && (
          <div className="border-b border-[#e6e9e2] px-5 py-3 dark:border-[#2c3c2d]">
            <button onClick={markAllNotificationsRead} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#668f2b] hover:text-[#456c13]"><CheckCheck size={14} /> Mark all as read</button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-6 py-20 text-center"><Bell size={28} className="mx-auto text-[#a7b4a1]" /><p className="mt-3 text-sm font-bold text-[#536051]">No notifications yet</p><p className="mt-1 text-xs leading-5 text-[#929a90]">Competition updates and platform notices will appear here.</p></div>
          ) : notifications.map((notification) => (
            <button key={notification.id} onClick={() => !notification.isRead && markNotificationRead(notification.id)} className={`block w-full border-b border-[#edf0e9] px-5 py-4 text-left transition hover:bg-[#f4f8ed] dark:border-[#243225] dark:hover:bg-[#1a2a1b] ${notification.isRead ? "opacity-70" : "bg-[#fbfef7]"}`}>
              <div className="flex gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.isRead ? "bg-[#c5cbc2]" : "bg-[#91c63e]"}`} /><div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-[#344033] dark:text-[#e2ede0]">{notification.title}</p><p className="mt-1 text-xs leading-5 text-[#748071] dark:text-[#aab9a8]">{notification.message}</p><p className="mt-2 text-[10px] font-semibold text-[#a0a89d]">{new Date(notification.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></div></div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
