(function (root) {
  "use strict";
  const KEY = "skyloom.library.v1";
  const LEGACY_KEY = "creativeArcana.library.v3";
  const RECOVERY_KEY = "creativeArcana.recovery.original.v1";
  const YEAR = 365 * 24 * 60 * 60 * 1000;
  const GROUPS = ["general", "romance", "dark", "adult"];
  const skyloomId = id => typeof id === "string" && /^c(?:0[1-9]|1[0-7])$/.test(id);
  const cardKey = card => JSON.stringify([card.deckId, card.number, card.prompt]);
  const validCard = card => card && typeof card.deckId === "string" && typeof card.prompt === "string" && typeof card.source === "string" && GROUPS.includes(card.group) && Number.isFinite(card.number);
  const validEntry = entry => entry && typeof entry.id === "string" && Number.isFinite(Date.parse(entry.date)) && Array.isArray(entry.cards) && entry.cards.length > 0 && entry.cards.every(validCard);
  const validDeck = deck => deck && typeof deck.id === "string" && typeof deck.title === "string" && GROUPS.includes(deck.group) && Array.isArray(deck.items) && deck.items.every(item => item && Number.isFinite(item.number) && typeof item.prompt === "string");
  const copy = value => JSON.parse(JSON.stringify(value));
  function mergeUnique(current, incoming, key) {
    const merged = [...current], seen = new Set(current.map(key));
    incoming.forEach(item => {
      const id = key(item);
      if (!seen.has(id)) { seen.add(id); merged.push(copy(item)); }
    });
    return merged;
  }

  function createStore(storage, now = () => Date.now(), defaultGroups = Array.from({ length: 17 }, (_, i) => `c${String(i + 1).padStart(2, "0")}`)) {
    let state;
    let loadError = false;
    const empty = () => ({ history: [], prompts: [], sets: [], decks: [], groups: [...defaultGroups] });
    const hasShape = value => value && ["history", "prompts", "sets", "decks", "groups"].every(key => Array.isArray(value[key]));
    const cleanCard = card => ({ deckId: card.deckId, categoryId: card.deckId, source: card.source, group: card.group, number: card.number, prompt: card.prompt });
    const ownCard = card => validCard(card) && skyloomId(card.deckId) && (card.categoryId === undefined || card.categoryId === card.deckId);
    const ownEntry = entry => validEntry(entry) && entry.cards.every(ownCard);
    function cleanLibrary(value, fallbackGroups) {
      if (!hasShape(value)) throw new Error("Invalid library");
      const groups = value.groups.filter(skyloomId);
      const entries = list => list.filter(ownEntry).map(entry => ({ id: entry.id, date: entry.date, mode: entry.cards.length === 1 ? "single" : "triple", cards: entry.cards.map(cleanCard) }));
      return {
        history: entries(value.history).filter(entry => Date.parse(entry.date) >= now() - YEAR),
        prompts: value.prompts.filter(ownCard).map(cleanCard),
        sets: entries(value.sets),
        decks: value.decks.filter(deck => validDeck(deck) && skyloomId(deck.id) && (deck.categoryId === undefined || deck.categoryId === deck.id)).map(deck => ({ id: deck.id, categoryId: deck.id, title: deck.title, group: deck.group, items: deck.items.map(item => ({ number: item.number, prompt: item.prompt })) })),
        groups: value.groups.length === 0 || groups.length ? groups : [...fallbackGroups]
      };
    }
    function mergeLibraries(current, incoming) {
      return {
        history: mergeUnique(current.history, incoming.history, entry => entry.id),
        prompts: mergeUnique(current.prompts, incoming.prompts, cardKey),
        sets: mergeUnique(current.sets, incoming.sets, entry => entry.id),
        decks: mergeUnique(current.decks, incoming.decks, deck => deck.id),
        groups: [...current.groups],
        migrationVersion: 1
      };
    }
    try {
      const saved = storage.getItem(KEY);
      const original = saved === null ? null : JSON.parse(saved);
      state = saved === null ? empty() : cleanLibrary(original, defaultGroups);
      // A valid dedicated library, including an intentionally empty one, wins.
      if (original === null) {
        let sourceError;
        for (const key of [LEGACY_KEY, RECOVERY_KEY]) {
          try {
            const raw = storage.getItem(key);
            if (raw === null) continue;
            const parsed = JSON.parse(raw);
            const incoming = cleanLibrary(parsed, defaultGroups);
            // Fallback groups are defaults, not evidence of Skyloom ownership.
            const hasData = ["history", "prompts", "sets", "decks"].some(name => incoming[name].length) || parsed.groups.some(skyloomId);
            if (!hasData) continue;
            state = incoming;
            sourceError = undefined;
            break;
          } catch (error) { sourceError = error; }
        }
        if (sourceError) throw sourceError;
      }
      state.migrationVersion = 1;
      // Data and completion marker are saved atomically. Failed writes retry on reload.
      if (JSON.stringify(state) !== saved) storage.setItem(KEY, JSON.stringify(state));
    } catch {
      state = state || empty();
      delete state.migrationVersion;
      loadError = true;
    }
    function snapshot() {
      const result = copy(state);
      result.history = result.history.filter(entry => Date.parse(entry.date) >= now() - YEAR);
      return result;
    }
    function commit(change) {
      if (loadError) throw new Error("收藏資料無法讀取，為避免覆寫，請先確認瀏覽器的儲存設定或備份資料。");
      const next = snapshot();
      change(next);
      try { storage.setItem(KEY, JSON.stringify(next)); }
      catch { throw new Error("儲存失敗，可能是瀏覽器儲存空間不足或未開放儲存。這次變更尚未保存。"); }
      state = next;
    }
    function exportBackup() {
      const backup = { format: "skyloom-library", version: 1, exportedAt: new Date(now()).toISOString(), data: snapshot() };
      const legacy = storage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        try { backup.legacyData = JSON.parse(legacy); }
        catch { backup.legacyRaw = legacy; }
      }
      return backup;
    }
    function importData(input) {
      let imported = input;
      if (input && input.format === "skyloom-library") {
        if (input.version !== 1) throw new Error("此備份版本不受支援。");
        imported = input.data;
      }
      if (!hasShape(imported)) throw new Error("檔案格式不正確或資料不完整，沒有匯入任何內容。");
      const current = loadError ? empty() : snapshot();
      imported = cleanLibrary(imported, current.groups);
      const next = mergeLibraries(current, imported);
      next.groups = imported.groups;
      try { storage.setItem(KEY, JSON.stringify(next)); }
      catch { throw new Error("匯入失敗，瀏覽器儲存空間不足或未開放儲存；原有資料未變更。"); }
      state = next;
      loadError = false;
      return {
        history: next.history.length - current.history.length,
        prompts: next.prompts.length - current.prompts.length,
        sets: next.sets.length - current.sets.length,
        decks: next.decks.length - current.decks.length
      };
    }
    function toggle(list, value, key) {
      const index = list.findIndex(item => key(item) === key(value));
      if (index === -1) list.unshift(copy(value));
      else list.splice(index, 1);
    }
    return {
      snapshot, get loadError() { return loadError; }, exportBackup, importData,
      record(entry) { commit(next => next.history.unshift(copy(entry))); },
      togglePrompt(card) { commit(next => toggle(next.prompts, card, cardKey)); },
      toggleSet(entry) { commit(next => toggle(next.sets, entry, item => item.id)); },
      toggleDeck(deck) { commit(next => toggle(next.decks, deck, item => item.id)); },
      setGroups(groups) { commit(next => { next.groups = [...groups]; }); },
      clearHistory() { commit(next => { next.history = []; }); }
    };
  }
  function deckCards(deck) {
    return deck.items.map(item => ({ deckId: deck.id, ...(deck.categoryId ? { categoryId: deck.categoryId } : {}), source: deck.title, group: deck.group, number: item.number, prompt: item.prompt }));
  }
  function poolFor(data, state, source) {
    const currentGroups = new Map(data.decks.map(deck => [deck.id, deck.group]));
    const cards = source === "favorites" ? state.prompts
      : source === "decks" ? state.decks.flatMap(deckCards)
      : data.decks.flatMap(deckCards);
    // Saved snapshots retain their content, but category corrections also apply to old favorites.
    const classified = cards.map(card => ({ ...card, group: currentGroups.get(card.deckId) || card.group }));
    return [...new Map(classified.filter(card => state.groups.includes(card.categoryId || card.group)).map(card => [cardKey(card), card])).values()];
  }
  function sample(pool, count, random = Math.random) {
    const available = [...pool], cards = [];
    while (cards.length < count && available.length) cards.push(available.splice(Math.floor(random() * available.length), 1)[0]);
    return cards;
  }
  function sampleBalanced(pool, count, distinctCategories = false, random = Math.random) {
    const buckets = new Map();
    pool.forEach(card => {
      const category = card.categoryId || card.group;
      if (!buckets.has(category)) buckets.set(category, []);
      buckets.get(category).push(card);
    });
    const choose = values => values.splice(Math.floor(random() * values.length), 1)[0];
    const cards = [];
    if (distinctCategories) {
      const categories = [...buckets.keys()];
      while (categories.length && cards.length < count) {
        const category = choose(categories);
        cards.push(choose(buckets.get(category)));
      }
      return cards;
    }
    while (buckets.size && cards.length < count) {
      const categories = [...buckets.keys()];
      const category = categories[Math.floor(random() * categories.length)];
      const words = buckets.get(category);
      cards.push(choose(words));
      if (!words.length) buckets.delete(category);
    }
    return cards;
  }
  const api = { createStore, cardKey, deckCards, poolFor, sample, sampleBalanced, KEY, YEAR };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SkyloomStore = api;
})(typeof window !== "undefined" ? window : globalThis);
