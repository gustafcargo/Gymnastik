import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  heightPct?: number; // 0-100, default 70
};

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  heightPct = 72,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-slate-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl safe-bottom"
            style={{ height: `${heightPct}vh` }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="flex items-center justify-center py-2">
              <div className="h-1.5 w-10 rounded-full bg-surface-3" />
            </div>
            {title && (
              <div className="px-5 pb-2 text-base font-semibold">{title}</div>
            )}
            <div className="min-h-0 flex-1">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
