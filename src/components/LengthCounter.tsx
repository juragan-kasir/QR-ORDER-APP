// Field-length standard (BA DR-28): under a limited field, how many characters
// are used of the maximum; at the maximum the line says so in red. Typing
// stops there (the field's own maxLength).

interface LengthCounterProps {
  id: string;
  length: number;
  max: number;
}

const LengthCounter = ({ id, length, max }: LengthCounterProps) => {
  const atLimit = length >= max;
  return (
    <div id={id} aria-live="polite" className="mt-1 flex items-start justify-between gap-2 text-xs">
      <span className={`text-red-500 ${atLimit ? "" : "invisible"}`}>
        Sudah mencapai batas maksimal
      </span>
      <span
        className={`shrink-0 tabular-nums ${
          atLimit ? "font-medium text-red-500" : "text-gray-400 dark:text-gray-500"
        }`}
      >
        {length}/{max}
      </span>
    </div>
  );
};

export default LengthCounter;
