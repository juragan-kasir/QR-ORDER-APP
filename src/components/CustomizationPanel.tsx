import React, { useId } from 'react';
import type { Product, Size, Spiciness } from '../types';
import LengthCounter from './LengthCounter';
import { FIELD_LIMITS, limitBorder } from '../utils/fieldLimits';

interface CustomizationPanelProps {
  product: Product;
  selectedSize: Size | undefined;
  selectedSpiciness: Spiciness | undefined;
  selectedAddOns: string[];
  selectedOptionChoices: Record<string, string>;
  notes: string;
  onSizeChange: (size: Size | undefined) => void;
  onSpicinessChange: (spiciness: Spiciness | undefined) => void;
  onAddOnToggle: (addOnId: string) => void;
  onOptionChoiceChange: (groupId: string, choiceName: string | undefined) => void;
  onNotesChange: (notes: string) => void;
}

const CustomizationPanel: React.FC<CustomizationPanelProps> = ({
  product,
  selectedSize,
  selectedSpiciness,
  selectedAddOns,
  selectedOptionChoices,
  notes,
  onSizeChange,
  onSpicinessChange,
  onAddOnToggle,
  onOptionChoiceChange,
  onNotesChange,
}) => {
  const notesCounterId = useId();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 space-y-6 border border-gray-50 dark:border-gray-700/50 shadow-sm">
      {product.sizes && product.sizes.length > 0 && (
        <div>
          <h4 className="font-bold text-sm mb-3 text-gray-900 dark:text-gray-100">Pilih Ukuran</h4>
          <div className="flex gap-2 flex-wrap">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() =>
                  onSizeChange(selectedSize === size ? undefined : size)
                }
                className={`px-5 py-2.5 rounded-full text-sm font-medium border-2 transition-all ${
                  selectedSize === size
                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-primary/50'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {product.optionGroups?.map((group) => (
        <div key={group.id}>
          <h4 className="font-bold text-sm mb-3 text-gray-900 dark:text-gray-100">{group.name}</h4>
          <div className="flex gap-2 flex-wrap">
            {group.choices.map((choice) => {
              const isSelected = selectedOptionChoices[group.id] === choice.name;
              return (
                <button
                  key={choice.name}
                  onClick={() =>
                    onOptionChoiceChange(group.id, isSelected ? undefined : choice.name)
                  }
                  className={`px-5 py-2.5 rounded-full text-sm font-medium border-2 transition-all ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-primary/50'
                  }`}
                >
                  {choice.name}
                  {choice.price > 0 && (
                    <span className="ml-1 opacity-70">
                      +Rp{choice.price.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {product.spicinessLevels && product.spicinessLevels.length > 0 && (
        <div>
          <h4 className="font-bold text-sm mb-3 text-gray-900 dark:text-gray-100">Level Pedas</h4>
          <div className="flex gap-2 flex-wrap">
            {product.spicinessLevels.map((level) => (
              <button
                key={level}
                onClick={() =>
                  onSpicinessChange(
                    selectedSpiciness === level ? undefined : level
                  )
                }
                className={`px-5 py-2.5 rounded-full text-sm font-medium border-2 transition-all ${
                  selectedSpiciness === level
                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-primary/50'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}

      {product.addOns && product.addOns.length > 0 && (
        <div>
          <h4 className="font-bold text-sm mb-3 text-gray-900 dark:text-gray-100">Extra Topping</h4>
          <div className="flex gap-2 flex-wrap">
            {product.addOns.map((addOn) => {
              const isSelected = selectedAddOns.includes(addOn.id);
              return (
                <button
                  key={addOn.id}
                  onClick={() => onAddOnToggle(addOn.id)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium border-2 transition-all ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-primary/50'
                  }`}
                >
                  {addOn.name}
                  <span className="ml-1 opacity-70">
                    +Rp{addOn.price.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h4 className="font-bold text-sm mb-3 text-gray-900 dark:text-gray-100">Catatan Khusus</h4>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Contoh: tanpa bawang, es sedikit, dll."
          maxLength={FIELD_LIMITS.DESCRIPTION}
          aria-describedby={notesCounterId}
          className={`w-full p-4 border-2 ${limitBorder(notes, FIELD_LIMITS.DESCRIPTION, 'border-gray-200 dark:border-gray-600 focus:ring-primary/30 focus:border-primary')} rounded-2xl text-sm focus:outline-none focus:ring-2 resize-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors`}
          rows={3}
        />
        <LengthCounter id={notesCounterId} length={notes.length} max={FIELD_LIMITS.DESCRIPTION} />
      </div>
    </div>
  );
};

export default CustomizationPanel;
