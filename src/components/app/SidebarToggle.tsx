import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

/** A playful sidebar collapse toggle: the icon morphs with a little spin,
 *  the button springs on press, and a tooltip shows the ⌘B shortcut. */
export function SidebarToggle() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className="relative group/tog shrink-0">
      <motion.button
        onClick={toggleSidebar}
        aria-label={collapsed ? "Sidebar uitklappen" : "Sidebar inklappen"}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.85 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
        className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:border-primary/30 hover:text-primary"
      >
        {/* soft accent wash on hover */}
        <span className="absolute inset-0 bg-primary/0 transition-colors duration-200 group-hover/tog:bg-primary/[0.06]" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={collapsed ? "open" : "close"}
            initial={{ opacity: 0, rotate: -35, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 35, scale: 0.5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative grid place-items-center"
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* tooltip */}
      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-md transition-all duration-150 group-hover/tog:translate-y-0 group-hover/tog:opacity-100">
        {collapsed ? "Uitklappen" : "Inklappen"}
        <kbd className="ml-1 rounded bg-background/20 px-1 py-px text-[10px]">⌘B</kbd>
      </div>
    </div>
  );
}
