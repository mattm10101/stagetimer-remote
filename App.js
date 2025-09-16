import React, { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { io } from 'socket.io-client';

const ROOM_ID = '55T3E3HN';
const API_KEY = '087a607d0b6b88601123f9ccdba3a898';

const API_BASE_URL = 'https://api.stagetimer.io/v1';
const SOCKET_URL = 'https://api.stagetimer.io';

export default function App() {
  const viewerUrl = `https://stagetimer.io/r/${ROOM_ID}/`;

  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // --- Socket: keep isRunning in sync with StageTimer server
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: '/v1/socket.io',
      auth: { room_id: ROOM_ID, api_key: API_KEY },
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', (err) => {
      console.error('Socket error:', err?.message || err);
      setIsConnected(false);
    });

    socket.on('playback_status', (data) => {
      setIsRunning(!!data?.running);
    });

    return () => socket.disconnect();
  }, []);

  // --- Simple GET helper
  const sendApiRequest = async (endpoint) => {
    try {
      const url = `${API_BASE_URL}${endpoint}?room_id=${ROOM_ID}&api_key=${API_KEY}`;
      const res = await fetch(url, { method: 'GET' });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'API request failed');
      return text;
    } catch (e) {
      console.error('API Error:', e);
      Alert.alert('Error', e.message);
    }
  };

  // Controls
  const handleStartPause = () => sendApiRequest('/start_or_stop');
  const handleNext = () => sendApiRequest('/next');
  const handlePrevious = () => sendApiRequest('/previous');

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {/* TOP: Timer viewer with neon border */}
        <View style={styles.viewerFrame}>
          <View style={styles.viewerInner}>
            <WebView
              source={{ uri: viewerUrl }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
            />
          </View>
        </View>

        {/* MIDDLE: Spacer */}
        <View style={styles.middle} />

        {/* BOTTOM: Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={[styles.btn, styles.navBtn]} onPress={handlePrevious}>
            <Icon name="skip-previous" size={40} color="#5bc0de" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btn,
              isRunning ? styles.pauseBtn : styles.playBtn,
            ]}
            onPress={handleStartPause}
          >
            <Icon name={isRunning ? 'pause' : 'play-arrow'} size={50} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.navBtn]} onPress={handleNext}>
            <Icon name="skip-next" size={40} color="#5bc0de" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },

  viewerFrame: {
    height: 150,
    width: '100%',
    padding: 6,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#00e5ff',
    backgroundColor: '#00181c',
    shadowColor: '#00e5ff',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  viewerInner: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webview: { flex: 1 },

  middle: { flex: 1 },

  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingVertical: 16,
  },
  btn: {
    padding: 20,
    borderRadius: 50,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  pauseBtn: { backgroundColor: '#dc3545' }, // red pause when running
  playBtn: { backgroundColor: '#28a745' },  // green play when paused
  navBtn: { backgroundColor: '#222' },
});
