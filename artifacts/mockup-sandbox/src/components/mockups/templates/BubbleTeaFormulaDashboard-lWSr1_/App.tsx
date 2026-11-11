import { useState, useMemo } from 'react';
import {
  FlaskConical, Search, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronRight, Beaker, TrendingUp, TrendingDown, Minus,
  CircleDot, Plus, Download, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DRINKS = [
  { id: 'BL-001', name: 'Classic Brown Sugar', series: 'Signature', base: 'Black tea · Whole milk', topping: 'Tapioca pearls', sweetness: 4, sold30: 1842, trend: 12.4, cost: 1.18, price: 5.75, status: 'Active', batch: 'Drum-roasted syrup, 40min reduction' },
  { id: 'BL-002', name: 'Matcha Cloud', series: 'Lab Series', base: 'Uji matcha · Oat milk', topping: 'Sea salt foam', sweetness: 2, sold30: 1267, trend: 28.1, cost: 1.64, price: 6.50, status: 'Active', batch: 'Ceremonial grade, whisked to order' },
  { id: 'BL-003', name: 'Taro Velvet', series: 'Signature', base: 'Taro purée · Fresh milk', topping: 'Pudding', sweetness: 3, sold30: 1104, trend: 4.2, cost: 1.42, price: 6.25, status: 'Active', batch: 'House-mashed taro, no powder' },
  { id: 'BL-004', name: 'Yuzu Jasmine Fizz', series: 'Lab Series', base: 'Jasmine green · Sparkling', topping: 'Aloe cubes', sweetness: 2, sold30: 689, trend: 41.7, cost: 1.31, price: 6.00, status: 'Trial', batch: 'Kochi yuzu concentrate, batch #7' },
  { id: 'BL-005', name: 'Thai Tea No.9', series: 'Classics', base: 'Assam blend · Condensed milk', topping: 'Tapioca pearls', sweetness: 5, sold30: 934, trend: -3.8, cost: 0.96, price: 5.50, status: 'Active', batch: 'Star anise + cardamom infusion' },
  { id: 'BL-006', name: 'Black Sesame Latte', series: 'Lab Series', base: 'Roasted sesame · Soy milk', topping: 'Mochi', sweetness: 3, sold30: 412, trend: 9.6, cost: 1.55, price: 6.75, status: 'Trial', batch: 'Stone-ground paste, toasted in-house' },
  { id: 'BL-007', name: 'Lychee Oolong', series: 'Classics', base: 'Tieguanyin oolong', topping: 'Lychee jelly', sweetness: 3, sold30: 758, trend: -1.2, cost: 1.12, price: 5.75, status: 'Active', batch: 'Cold-steeped 8hr' },
  { id: 'BL-008', name: 'Strawberry Sago', series: 'Seasonal', base: 'Fresh strawberry · Coconut milk', topping: 'Mini sago', sweetness: 4, sold30: 1521, trend: 67.3, cost: 1.88, price: 7.00, status: 'Active', batch: 'Harry\'s Berries, muddled daily' },
  { id: 'BL-009', name: 'Hojicha Pearl', series: 'Classics', base: 'Roasted hojicha · Whole milk', topping: 'Tapioca pearls', sweetness: 2, sold30: 503, trend: 6.9, cost: 1.21, price: 5.95, status: 'Active', batch: 'Double-roast leaf, Kyoto origin' },
  { id: 'BL-010', name: 'Winter Melon Frost', series: 'Seasonal', base: 'Winter melon · Green tea', topping: 'Crystal boba', sweetness: 3, sold30: 287, trend: -18.5, cost: 1.05, price: 5.50, status: 'Paused', batch: 'Caramelized melon brick, slow-melt' },
  { id: 'BL-011', name: 'Vietnamese Coffee Boba', series: 'Lab Series', base: 'Robusta drip · Condensed milk', topping: 'Coffee jelly', sweetness: 4, sold30: 845, trend: 22.0, cost: 1.37, price: 6.50, status: 'Active', batch: 'Phin-brewed concentrate, 2:1 ratio' },
  { id: 'BL-012', name: 'Osmanthus Honey Pearl', series: 'Seasonal', base: 'Osmanthus oolong', topping: 'Honey boba', sweetness: 3, sold30: 196, trend: 0, cost: 1.48, price: 6.25, status: 'Archived', batch: 'Dried blossom infusion, autumn run' },
];

const SERIES_COLORS = {
  'Signature': { bg: '#3D2B1F', text: '#F5EDE0' },
  'Lab Series': { bg: '#5B7553', text: '#F0F5EC' },
  'Classics': { bg: '#C2703D', text: '#FFF4E8' },
  'Seasonal': { bg: '#A65A6E', text: '#FCEEF2' },
};

const STATUS_STYLES = {
  Active: { dot: '#5B7553', bg: '#EDF2E8', text: '#3E5237' },
  Trial: { dot: '#C2913D', bg: '#F7F0DD', text: '#7A5C1E' },
  Paused: { dot: '#A65A6E', bg: '#F7E8EC', text: '#7A3D4C' },
  Archived: { dot: '#9A938A', bg: '#EFEBE4', text: '#6B655C' },
};

function Pearls({ level }) {
  return (
    <div className="flex items-center gap-[3px]">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className="block rounded-full transition-all"
          style={{
            width: 8, height: 8,
            background: i <= level ? '#2A1E14' : 'transparent',
            border: i <= level ? 'none' : '1.5px solid #D8CFС0',
            borderColor: i <= level ? 'transparent' : '#D8CFC0',
          }}
        />
      ))}
    </div>
  );
}

function Trend({ value }) {
  if (value === 0) return (
    <span className="inline-flex items-center gap-1 text-[#9A938A] text-[13px] font-medium">
      <Minus size={13} /> 0%
    </span>
  );
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] font-semibold ${up ? 'text-[#4A6B3F]' : 'text-[#A8453A]'}`}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {up ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('All');
  const [sortKey, setSortKey] = useState('sold30');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(null);

  const seriesList = ['All', 'Signature', 'Lab Series', 'Classics', 'Seasonal'];

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const rows = useMemo(() => {
    let r = DRINKS.filter(d =>
      (seriesFilter === 'All' || d.series === seriesFilter) &&
      (d.name.toLowerCase().includes(query.toLowerCase()) || d.id.toLowerCase().includes(query.toLowerCase()))
    );
    r.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === 'margin') { av = (a.price - a.cost) / a.price; bv = (b.price - b.cost) / b.price; }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return r;
  }, [query, seriesFilter, sortKey, sortDir]);

  const totalSold = DRINKS.reduce((s, d) => s + d.sold30, 0);
  const avgMargin = DRINKS.reduce((s, d) => s + (d.price - d.cost) / d.price, 0) / DRINKS.length;
  const activeCount = DRINKS.filter(d => d.status === 'Active').length;

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const headerCell = (label, key, align = 'left') => (
    <th
      onClick={() => toggleSort(key)}
      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A7165] cursor-pointer select-none hover:text-[#2A1E14] transition-colors whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <span className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label} <SortIcon k={key} />
      </span>
    </th>
  );

  return (
    <div className="min-h-screen bg-[#F4EFE6] text-[#2A1E14]" style={{ fontFamily: "'Spline Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Spline+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        body { margin: 0; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .serif { font-family: 'Fraunces', serif; }
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D6CCBC; border-radius: 99px; }
        .row-hover:hover { background: #FBF8F1; }
        .dotted-bg {
          background-image: radial-gradient(#E2D9C8 1.2px, transparent 1.2px);
          background-size: 22px 22px;
        }
        input::placeholder { color: #A89E8F; }
      `}} />

      {/* Top bar */}
      <div className="dotted-bg border-b border-[#E0D6C5]">
        <div className="max-w-[1180px] mx-auto px-6 pt-10 pb-8">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-[#2A1E14] flex items-center justify-center">
                  <FlaskConical size={20} className="text-[#F4EFE6]" />
                </div>
                <div>
                  <div className="mono text-[11px] tracking-[0.2em] uppercase text-[#8A7F6F]">Boba Lab · Recipe Console</div>
                  <h1 className="serif text-[32px] leading-tight font-semibold -mt-0.5">Formula Index</h1>
                </div>
              </div>
              <p className="text-[14px] text-[#6E6457] max-w-md">
                Every drink we pour, tracked like an experiment. Sales pulled from the last 30 days across both locations.
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-px bg-[#E0D6C5] rounded-2xl overflow-hidden border border-[#E0D6C5] shadow-sm">
              {[
                { label: 'Cups / 30d', value: totalSold.toLocaleString() },
                { label: 'Live formulas', value: `${activeCount} of ${DRINKS.length}` },
                { label: 'Avg margin', value: `${(avgMargin * 100).toFixed(0)}%` },
              ].map(s => (
                <div key={s.label} className="bg-[#FBF8F1] px-6 py-4 min-w-[130px]">
                  <div className="mono text-[10px] uppercase tracking-[0.15em] text-[#8A7F6F] mb-1">{s.label}</div>
                  <div className="serif text-[24px] font-semibold">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-[1180px] mx-auto px-6 pt-6 pb-4 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89E8F]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search formula or code…"
            className="pl-10 pr-4 py-2.5 w-[260px] bg-white border border-[#E0D6C5] rounded-full text-[14px] outline-none focus:border-[#2A1E14] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {seriesList.map(s => (
            <button
              key={s}
              onClick={() => setSeriesFilter(s)}
              className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all border ${
                seriesFilter === s
                  ? 'bg-[#2A1E14] text-[#F4EFE6] border-[#2A1E14]'
                  : 'bg-white text-[#6E6457] border-[#E0D6C5] hover:border-[#B8AC97]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-[#E0D6C5] text-[13px] font-medium text-[#6E6457] hover:border-[#B8AC97] transition-colors">
            <Download size={14} /> Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2A1E14] text-[#F4EFE6] text-[13px] font-medium hover:bg-[#43321F] transition-colors">
            <Plus size={14} /> New formula
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-[1180px] mx-auto px-6 pb-16">
        <div className="bg-white border border-[#E6DCCB] rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(42,30,20,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[920px]">
              <thead>
                <tr className="border-b border-[#EDE5D6] bg-[#FBF8F1]">
                  <th className="w-10"></th>
                  {headerCell('Code', 'id')}
                  {headerCell('Formula', 'name')}
                  {headerCell('Series', 'series')}
                  {headerCell('Sweetness', 'sweetness')}
                  {headerCell('Sold / 30d', 'sold30', 'right')}
                  {headerCell('Trend', 'trend', 'right')}
                  {headerCell('Margin', 'margin', 'right')}
                  {headerCell('Status', 'status')}
                </tr>
              </thead>
              <tbody>
                {rows.map((d, i) => {
                  const margin = ((d.price - d.cost) / d.price) * 100;
                  const sc = SERIES_COLORS[d.series];
                  const st = STATUS_STYLES[d.status];
                  const isOpen = expanded === d.id;
                  return (
                    <motion.tr key={d.id + (isOpen ? '-open' : '')} layout="position"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      onClick={() => setExpanded(isOpen ? null : d.id)}
                      className={`row-hover cursor-pointer border-b border-[#F1EADD] last:border-0 align-middle ${isOpen ? 'bg-[#FBF8F1]' : ''}`}
                    >
                      <td className="pl-4 py-0">
                        <ChevronRight size={15} className={`text-[#B8AC97] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                      </td>
                      <td className="px-4 py-4">
                        <span className="mono text-[12px] font-medium text-[#8A7F6F] tracking-wide">{d.id}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[14.5px]">{d.name}</div>
                        <div className="text-[12.5px] text-[#8A7F6F] mt-0.5">{d.base} · {d.topping}</div>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2.5 flex items-center gap-2 text-[12px] text-[#5B7553]">
                                <Beaker size={13} />
                                <span className="font-medium">Lab note:</span>
                                <span className="text-[#6E6457]">{d.batch}</span>
                                <span className="mono text-[#8A7F6F] ml-2">cost ${d.cost.toFixed(2)} → ${d.price.toFixed(2)}</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide" style={{ background: sc.bg, color: sc.text }}>
                          {d.series}
                        </span>
                      </td>
                      <td className="px-4 py-4"><Pearls level={d.sweetness} /></td>
                      <td className="px-4 py-4 text-right">
                        <span className="mono text-[14px] font-medium">{d.sold30.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-4 text-right"><Trend value={d.trend} /></td>
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex flex-col items-end gap-1">
                          <span className="mono text-[13px] font-medium">{margin.toFixed(0)}%</span>
                          <div className="w-14 h-[3px] rounded-full bg-[#EFE8DA] overflow-hidden">
                            <div className="h-full rounded-full bg-[#2A1E14]" style={{ width: `${margin}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium" style={{ background: st.bg, color: st.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                          {d.status}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <CircleDot size={28} className="mx-auto text-[#C9BEAC] mb-3" />
                      <div className="serif text-[18px] text-[#6E6457]">No formulas match that brew.</div>
                      <div className="text-[13px] text-[#A89E8F] mt-1">Try clearing the search or switching series.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#EDE5D6] bg-[#FBF8F1]">
            <span className="text-[12.5px] text-[#8A7F6F]">
              Showing <span className="font-semibold text-[#2A1E14]">{rows.length}</span> of {DRINKS.length} formulas
              {seriesFilter !== 'All' && <> in <span className="font-semibold text-[#2A1E14]">{seriesFilter}</span></>}
            </span>
            <span className="mono text-[11px] text-[#A89E8F] tracking-wide">SYNCED 4 MIN AGO · POS v2.3</span>
          </div>
        </div>

        <p className="text-center text-[12px] text-[#A89E8F] mt-6">
          Click any row to reveal lab notes & unit economics · Sweetness measured in pearls, naturally
        </p>
      </div>
    </div>
  );
}