import { useGameStore } from '../stores/game-store';

export function InventoryPanel() {
  const inventory = useGameStore((s) => s.inventory);
  const equipment = useGameStore((s) => s.equipment);
  const itemDefinitions = useGameStore((s) => s.itemDefinitions);

  return (
    <div className="p-3 space-y-4">
      {/* Equipment */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Equipment</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Weapon:</span>
            <span className="text-gray-300">
              {equipment.weapon ? itemDefinitions[equipment.weapon]?.name || equipment.weapon : 'None'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Armor:</span>
            <span className="text-gray-300">
              {equipment.armor ? itemDefinitions[equipment.armor]?.name || equipment.armor : 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Inventory */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          Inventory ({inventory.length})
        </h3>
        {inventory.length === 0 ? (
          <p className="text-gray-600 text-sm">Empty</p>
        ) : (
          <ul className="space-y-1">
            {inventory.map((item) => {
              const def = itemDefinitions[item.itemId];
              return (
                <li key={item.itemId} className="text-sm text-gray-300 flex justify-between">
                  <span>{def?.name || item.itemId}</span>
                  {item.quantity > 1 && (
                    <span className="text-gray-500">x{item.quantity}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
