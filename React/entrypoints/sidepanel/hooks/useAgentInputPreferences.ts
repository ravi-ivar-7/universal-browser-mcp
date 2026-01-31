import { useState, useCallback } from 'react';

export function useAgentInputPreferences() {
    const [fakeCaretEnabled, setFakeCaretEnabled] = useState(false);
    const setEnabled = useCallback(async (val: boolean) => { setFakeCaretEnabled(val); }, []);

    return {
        fakeCaretEnabled,
        setFakeCaretEnabled: setEnabled
    };
}
