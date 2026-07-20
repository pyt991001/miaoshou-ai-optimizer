export interface MiaoshouCategory {
  id: string;
  name: string;
  parentId?: string;
  rawData?: Record<string, unknown>;
}

export async function listMockCategories(): Promise<MiaoshouCategory[]> {
  return [
    { id: "women-dresses", name: "Women's Dresses" },
    { id: "drinkware", name: "Drinkware" }
  ];
}
