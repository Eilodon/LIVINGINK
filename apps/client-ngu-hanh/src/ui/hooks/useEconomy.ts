import { useState, useEffect } from 'react';
import { NetworkManager } from '../../network/NetworkManager';

export const useEconomy = () => {
    const [balance, setBalance] = useState({ gold: 0, gems: 0 });

    useEffect(() => {
        const net = NetworkManager.getInstance();

        // Initial state
        setBalance({ ...net.wallet });

        const onUpdate = (gold: number, gems: number) => {
            setBalance({ gold, gems });
        };

        net.onWalletUpdate = onUpdate;

        return () => {
            net.onWalletUpdate = null; // Simple cleanup, ideally use event emitter for multiple listeners
        };
    }, []);

    const purchaseItem = (itemId: string) => {
        NetworkManager.getInstance().sendAction('purchase', { itemId });
    };

    return {
        gold: balance.gold,
        gems: balance.gems,
        purchaseItem
    };
};
