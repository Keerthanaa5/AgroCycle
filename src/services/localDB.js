export const KEYS = {
  AGRO: "agroPosts",
  WASTE: "wastePosts",
  CLAIMS: "claims",
  CARBON: "carbonLogs"
};

export const localDB = {
  getData: (key) => {
    return JSON.parse(localStorage.getItem(key)) || [];
  },
  
  saveData: (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  },
  
  addItem: (key, item) => {
    const existing = localDB.getData(key);
    localDB.saveData(key, [item, ...existing]);
  },
  
  updateItem: (key, id, data) => {
    const existing = localDB.getData(key);
    const updated = existing.map(item => item.id === id ? { ...item, ...data } : item);
    localDB.saveData(key, updated);
  },
  
  deleteItem: (key, id) => {
    const existing = localDB.getData(key);
    const filtered = existing.filter(item => item.id !== id);
    localDB.saveData(key, filtered);
  }
};
