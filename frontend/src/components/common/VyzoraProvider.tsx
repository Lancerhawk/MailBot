'use client';
import { useEffect } from 'react';
import { Vyzora } from 'vyzora-sdk';

export default function VyzoraProvider() {
    useEffect(() => {
        let isMounted = true;

        async function initVyzora() {
            let shouldEnable = process.env.NEXT_PUBLIC_VYZORA_ENABLED === 'true';

            try {
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('admin_no_track') === 'true') {
                    localStorage.setItem('admin_no_track', 'true');
                    console.log('Vyzora tracking disabled via URL flag');
                } else if (urlParams.get('admin_no_track') === 'false') {
                    localStorage.removeItem('admin_no_track');
                    console.log('Vyzora tracking enabled via URL flag');
                }
                
                if (localStorage.getItem('admin_no_track') === 'true') {
                    shouldEnable = false;
                    console.log('Vyzora tracking disabled for this browser');
                }
            } catch (error) {
                console.error('Failed to parse admin_no_track flag', error);
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