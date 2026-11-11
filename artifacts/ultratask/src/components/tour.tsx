import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWs } from '@/lib/workspace';
import { HexMark, Kbd } from './atoms';

const STEPS = [
  { kicker: 'Welcome', title: 'Out of the group chat.', body: 'Every ask here has exactly one owner and one due date. No more "who was doing this?"', art: 'hex' },
  { kicker: 'Two lists', title: 'Yours, and what you\'re owed.', body: 'My tasks is what others asked of you. Waiting on is what you asked of others — it stays until you confirm it\'s done.', art: 'lists' },
  { kicker: 'Fast hands', title: 'Press N. Pick a person. Pick a date.', body: 'Due chips skip non-working days and default to 6 PM IST. Ask for more time instead of going quiet.', art: 'keys' },
] as const;

export function Tour() {
  const { me, isPreview } = useWs();
  const key = `ut:tour:${me.id}`;
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!isPreview && !localStorage.getItem(key)) { const id = setTimeout(() => setOpen(true), 700); return () => clearTimeout(id); }
    return undefined;
  }, [key, isPreview]);
  useEffect(() => {
    const h = () => { setI(0); setOpen(true); };
    window.addEventListener('ut:tour', h);
    return () => window.removeEventListener('ut:tour', h);
  }, []);
  const finish = () => { localStorage.setItem(key, '1'); setOpen(false); };
  const s = STEPS[i];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[440px]">
        <div className="relative flex h-44 items-center justify-center bg-sidebar">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
              {s.art === 'hex' && <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}><HexMark className="h-20 w-20" /></motion.div>}
              {s.art === 'lists' && (
                <div className="flex gap-3">{['My tasks', 'Waiting on'].map((l, j) => (
                  <motion.div key={l} initial={{ rotate: j ? 4 : -4 }} animate={{ rotate: j ? 2 : -2 }} className="w-32 rounded-lg bg-background p-2.5 shadow-lg">
                    <div className="text-[11px] font-semibold">{l}</div>
                    {[0, 1, 2].map((k) => <div key={k} className="mt-1.5 h-1.5 rounded bg-foreground/10" style={{ width: `${90 - k * 18}%` }} />)}
                  </motion.div>))}
                </div>
              )}
              {s.art === 'keys' && <div className="flex gap-2 text-lg">{['N', '/', 'J', 'K'].map((k, j) => <motion.span key={k} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: j * 0.08 }}><Kbd>{k}</Kbd></motion.span>)}</div>}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="px-6 pb-6 pt-5">
          <div className="mb-4 flex gap-1.5">{STEPS.map((_, j) => <motion.span key={j} className="h-1 flex-1 rounded-full bg-muted" animate={{ backgroundColor: j <= i ? 'hsl(186 70% 31%)' : 'hsl(40 16% 91.5%)' }} />)}</div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary">{s.kicker}</div>
          <DialogTitle className="mt-1 font-display text-[30px] leading-tight">{s.title}</DialogTitle>
          <DialogDescription className="mt-2 text-[14.5px] leading-relaxed">{s.body}</DialogDescription>
          <div className="mt-6 flex items-center">
            <button onClick={finish} className="text-sm text-muted-foreground hover:text-foreground" data-testid="button-tour-skip">Skip</button>
            <Button className="ml-auto rounded-full px-6" data-testid="button-tour-next" onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : finish())}>{i < STEPS.length - 1 ? 'Next' : 'Start working'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
