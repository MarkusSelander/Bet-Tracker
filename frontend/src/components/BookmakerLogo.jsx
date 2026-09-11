const BRANDS = {
  unibet: {
    label: 'UNIBET',
    className: 'bg-white text-[#14805e] tracking-[0.12em]',
  },
  coolbet: {
    label: 'Coolbet',
    className: 'bg-[#07160f] text-[#3dff8a] border border-[#3dff8a]/30',
  },
  bet365: {
    label: 'bet365',
    className: 'bg-[#ffcd00] text-black',
  },
  betsson: {
    label: 'BETSSON',
    className: 'bg-[#f7c600] text-black tracking-wide',
  },
  nordicbet: {
    label: 'NordicBet',
    className: 'bg-[#e10600] text-white',
  },
};

function brandKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export default function BookmakerLogo({ name, className = '' }) {
  if (!name) {
    return <span className={`text-xs text-text-muted ${className}`}>—</span>;
  }

  const brand = BRANDS[brandKey(name)];
  if (brand) {
    return (
      <span
        className={`inline-flex h-6 max-w-[92px] items-center justify-center rounded-[4px] px-1.5 text-[9px] font-extrabold leading-none ${brand.className} ${className}`}
        title={name}
      >
        {brand.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-6 max-w-[92px] items-center justify-center truncate rounded-[4px] bg-white px-1.5 text-[9px] font-extrabold leading-none text-black ${className}`}
      title={name}
    >
      {name}
    </span>
  );
}
