'use client';
import { useEffect } from 'react';
import { Vyzora } from 'vyzora-sdk';

export default function VyzoraProvider() {
    useEffect(() => {
        let isMounted = true;

        async function initVyzora() {
            let shouldEnable = process.env.NEXT_PUBLIC_VYZORA_ENABLED === 'true';

            const ignoredIp = process.env.NEXT_PUBLIC_IGNORED_IP;
            if (shouldEnable && ignoredIp) {
                try {
                    const res = await fetch('https://api.ipify.org?format=json');
                    const data = await res.json();
                    if (data.ip === ignoredIp) {
                        shouldEnable = false;
                        console.log('Vyzora tracking disabled for this IP');
                    }
                } catch (error) {
                    console.error('Failed to fetch IP for Vyzora tracking check', error);
                }
            }

            if (isMounted) {
                new Vyzora({
                    apiKey: process.env.NEXT_PUBLIC_VYZORA_KEY || '',
                    enabled: shouldEnable,
                });
            }
        }

        initVyzora();

        return () => {
            isMounted = false;
        };
    }, []);
    return null;
}