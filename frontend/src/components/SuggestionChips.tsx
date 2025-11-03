interface SuggestionChipsProps {
  suggestions: string[];
  onPick: (text: string) => void;
}

export function SuggestionChips({ suggestions, onPick }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto mt-2">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onPick(s)}
          className="text-left text-sm bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 shadow-sm transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}


