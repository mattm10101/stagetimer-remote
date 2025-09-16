import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Text,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default values, will be replaced by saved settings
const DEFAULT_ROOM_ID = '55T3E3HN';
const DEFAULT_API_KEY = '087a607d0b6b88601123f9ccdba3a898';

const API_BASE_URL = 'https://api.stagetimer.io/v1';
const SOCKET_URL = 'https://api.stagetimer.io';

const TIMER_PRESETS = [
  { label: '30 seconds', duration: { seconds: 30 } },
  { label: '1 minute', duration: { minutes: 1 } },
  { label: '2 minutes', duration: { minutes: 2 } },
  { label: '5 minutes', duration: { minutes: 5 } },
  { label: '10 minutes', duration: { minutes: 10 } },
];

const ADJUST_TIME_PRESETS = [
  { label: '30 seconds', value: 30000 },
  { label: '1 minute', value: 60000 },
  { label: '2 minutes', value: 120000 },
  { label: '5 minutes', value: 300000 },
  { label: '15 minutes', value: 900000 },
  { label: '30 minutes', value: 1800000 },
  { label: '60 minutes', value: 3600000 },
];

export default function App() {
  // --- STATE MANAGEMENT ---
  const [roomId, setRoomId] = useState(DEFAULT_ROOM_ID);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  // Temp state for settings inputs
  const [tempRoomId, setTempRoomId] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');
  
  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [timers, setTimers] = useState([]);
  const [currentTimerId, setCurrentTimerId] = useState(null);
  const [selectedTimerId, setSelectedTimerId] = useState(null);
  
  // Foldable states
  const [isTimersExpanded, setIsTimersExpanded] = useState(true);
  const [isAddTimerExpanded, setIsAddTimerExpanded] = useState(false);
  const [isDeleteTimerExpanded, setIsDeleteTimerExpanded] = useState(false);
  const [isAdjustTimeExpanded, setIsAdjustTimeExpanded] = useState(false);
  const [isActionsExpanded, setIsActionsExpanded] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  const [editingTimerId, setEditingTimerId] = useState(null);
  const [editingTimerName, setEditingTimerName] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  
  const viewerUrl = `https://stagetimer.io/r/${roomId}/`;

  // --- API & DATA ---
  const sendApiRequest = useCallback(async (endpoint, params = {}) => {
    if (!roomId || !apiKey) {
      Alert.alert('Missing Credentials', 'Please set Room ID and API Key in Settings.');
      return;
    }
    try {
      const query = new URLSearchParams({ room_id: roomId, api_key: apiKey, ...params });
      const url = `${API_BASE_URL}${endpoint}?${query.toString()}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error('API Error:', e);
      Alert.alert('Error', e.message);
    }
  }, [roomId, apiKey]);

  const fetchAllTimers = useCallback(async () => {
    if (!roomId || !apiKey) return;
    try {
      const query = new URLSearchParams({ room_id: roomId, api_key: apiKey });
      const url = `${API_BASE_URL}/get_all_timers?${query.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || 'Failed to fetch timers');
      setTimers(json.data || []);
    } catch (e) {
      console.error('Fetch Timers Error:', e);
      setTimers([]);
    }
  }, [roomId, apiKey]);

  // --- SETTINGS PERSISTENCE ---
  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('@roomId', tempRoomId);
      await AsyncStorage.setItem('@apiKey', tempApiKey);
      setRoomId(tempRoomId);
      setApiKey(tempApiKey);
      setIsSettingsExpanded(false);
      Alert.alert('Success', 'Settings saved. The app will now use the new credentials.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings.');
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedRoomId = await AsyncStorage.getItem('@roomId');
        const savedApiKey = await AsyncStorage.getItem('@apiKey');
        if (savedRoomId !== null) {
          setRoomId(savedRoomId);
          setTempRoomId(savedRoomId);
        }
        if (savedApiKey !== null) {
          setApiKey(savedApiKey);
          setTempApiKey(savedApiKey);
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to load settings.');
      }
    };
    loadSettings();
  }, []);

  // --- LIFECYCLE & SOCKETS ---
  useEffect(() => {
    fetchAllTimers();
  }, [fetchAllTimers]);

  useEffect(() => {
    if (!roomId || !apiKey) {
      setIsConnected(false);
      return;
    }
    const socket = io(SOCKET_URL, { path: '/v1/socket.io', auth: { room_id: roomId, api_key: apiKey } });
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setIsConnected(false);
    });
    socket.on('playback_status', (data) => {
      setIsRunning(!!data?.running);
      setCurrentTimerId(data?.timer_id);
      if (selectedTimerId === data?.timer_id) setSelectedTimerId(null);
    });
    socket.on('timers', () => fetchAllTimers());
    return () => socket.disconnect();
  }, [roomId, apiKey, fetchAllTimers, selectedTimerId]);


  // --- EVENT HANDLERS ---
  const handleUpdateTimerName = async (timerId, newName) => {
    if (editingTimerId !== timerId) return;
    const originalTimer = timers.find((t) => t._id === timerId);
    if (!newName.trim() || (originalTimer && originalTimer.name === newName)) {
      setEditingTimerId(null);
      return;
    }
    await sendApiRequest('/update_timer', { timer_id: timerId, name: newName });
    await fetchAllTimers();
    setEditingTimerId(null);
  };

  const handleAddTimer = async (duration, label) => {
    await sendApiRequest('/create_timer', { name: `New ${label} Timer`, ...duration });
    await fetchAllTimers();
  };

  const confirmDelete = (timer) => {
    Alert.alert('Delete Timer', `Are you sure you want to delete "${timer.name}"?`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
        await sendApiRequest('/delete_timer', { timer_id: timer._id });
        await fetchAllTimers();
      }}],
    );
  };
  const handlePlayTimer = (timerId) => sendApiRequest('/start_timer', { timer_id: timerId });
  const handleStartPause = () => sendApiRequest('/start_or_stop');
  const handleNext = () => sendApiRequest('/next');
  const handlePrevious = () => sendApiRequest('/previous');
  const handleReset = () => sendApiRequest('/reset');
  const handleToggleMessage = () => sendApiRequest('/show_or_hide_message');
  const handleToggleFlash = () => {
    const endpoint = isFlashing ? '/stop_flashing' : '/start_flashing';
    sendApiRequest(endpoint);
    setIsFlashing(!isFlashing);
  };
  const handleAddTime = (milliseconds) => sendApiRequest('/jump', { milliseconds });
  const handleSubtractTime = (milliseconds) => sendApiRequest('/jump', { milliseconds: -milliseconds });

  // --- RENDER ---
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.viewerFrame}><View style={styles.viewerInner}><WebView source={{ uri: viewerUrl }} style={styles.webview} javaScriptEnabled domStorageEnabled startInLoadingState /></View></View>

        <ScrollView style={styles.middle}>
          <View style={styles.foldableFrame}>
            <Pressable style={styles.foldableHeader} onPress={() => setIsTimersExpanded(!isTimersExpanded)}>
              <Text style={styles.headerText}>Timers</Text>
              <Icon name={isTimersExpanded ? 'expand-less' : 'expand-more'} size={30} color="#00e5ff" />
            </Pressable>
            {isTimersExpanded && (
              <View style={styles.foldableContent}>
                {timers.length > 0 ? (timers.map((timer, index) => {
                  const isCurrent = timer._id === currentTimerId;
                  const isSelected = timer._id === selectedTimerId;
                  const isEditing = timer._id === editingTimerId;

                  return (
                    <View key={timer._id} style={[styles.timerItemWrapper, index === timers.length - 1 && { borderBottomWidth: 0 }]}>
                      <Pressable
                        onPress={() => { if (isEditing) return; setSelectedTimerId(isSelected ? null : timer._id); }}
                        onLongPress={() => { if (!isEditing) { setEditingTimerId(timer._id); setEditingTimerName(timer.name); }}}
                        style={[styles.timerItemContent, isCurrent && styles.activeTimerItem, isSelected && !isCurrent && styles.selectedTimerItem ]}
                      >
                        <View style={styles.timerNameContainer}>
                          {isEditing ? (
                            <TextInput value={editingTimerName} onChangeText={setEditingTimerName} onBlur={() => handleUpdateTimerName(timer._id, editingTimerName)} style={[styles.timerName, isCurrent && styles.activeTimerName]} autoFocus selectTextOnFocus />
                          ) : (
                            <Text style={[styles.timerName, isCurrent && styles.activeTimerName]} numberOfLines={1}>{timer.name}</Text>
                          )}
                        </View>
                        <View style={styles.iconContainer}>
                          {isCurrent ? (
                            <TouchableOpacity onPress={() => handleStartPause()}>
                              <Icon name={isRunning ? 'pause-circle-filled' : 'play-circle-filled'} size={36} color={isRunning ? '#dc3545' : '#28a745'} />
                            </TouchableOpacity>
                          ) : isSelected ? (
                            <TouchableOpacity onPress={() => handlePlayTimer(timer._id)}>
                              <Icon name="play-circle-filled" size={36} color="#28a745" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </Pressable>
                    </View>
                  );
                })) : (<Text style={styles.loadingText}>No timers found.</Text>)}
              </View>
            )}
          </View>

          <View style={styles.foldableFrame}>
            <Pressable style={styles.foldableHeader} onPress={() => setIsAddTimerExpanded(!isAddTimerExpanded)}>
              <Text style={styles.headerText}>Add Timer</Text>
              <Icon name={isAddTimerExpanded ? 'expand-less' : 'expand-more'} size={30} color="#00e5ff" />
            </Pressable>
            {isAddTimerExpanded && (
              <View style={styles.foldableContent}>
                {TIMER_PRESETS.map(({ label, duration }, index) => (
                  <TouchableOpacity key={label} style={[styles.presetItem, index === TIMER_PRESETS.length - 1 && { borderBottomWidth: 0 }]} onPress={() => handleAddTimer(duration, label)}>
                    <Icon name="add-circle-outline" size={24} color="#5bc0de" />
                    <Text style={styles.presetItemText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.foldableFrame}>
            <Pressable style={styles.foldableHeader} onPress={() => setIsDeleteTimerExpanded(!isDeleteTimerExpanded)}>
              <Text style={styles.headerText}>Delete Timer</Text>
              <Icon name={isDeleteTimerExpanded ? 'expand-less' : 'expand-more'} size={30} color="#00e5ff" />
            </Pressable>
            {isDeleteTimerExpanded && (
              <View style={styles.foldableContent}>
                {timers.length > 0 ? (timers.map((timer, index) => (
                  <TouchableOpacity key={timer._id} style={[styles.deleteItem, index === timers.length - 1 && { borderBottomWidth: 0 }]} onPress={() => confirmDelete(timer)}>
                    <Icon name="remove-circle-outline" size={24} color="#dc3545" />
                    <Text style={styles.deleteItemText}>{timer.name}</Text>
                  </TouchableOpacity>
                ))) : (<Text style={styles.loadingText}>No timers to delete.</Text>)}
              </View>
            )}
          </View>

          <View style={styles.foldableFrame}>
            <Pressable style={styles.foldableHeader} onPress={() => setIsAdjustTimeExpanded(!isAdjustTimeExpanded)}>
              <Text style={styles.headerText}>Add / Subtract Time</Text>
              <Icon name={isAdjustTimeExpanded ? 'expand-less' : 'expand-more'} size={30} color="#00e5ff" />
            </Pressable>
            {isAdjustTimeExpanded && (
              <View style={styles.foldableContent}>
                {ADJUST_TIME_PRESETS.map((preset) => (
                    <View key={preset.label} style={styles.adjustTimeRow}>
                        <TouchableOpacity style={styles.adjustTimeButton} onPress={() => handleSubtractTime(preset.value)}>
                            <Icon name="remove" size={24} color="#dc3545" />
                        </TouchableOpacity>
                        <Text style={styles.adjustTimeLabel}>{preset.label}</Text>
                        <TouchableOpacity style={styles.adjustTimeButton} onPress={() => handleAddTime(preset.value)}>
                            <Icon name="add" size={24} color="#28a745" />
                        </TouchableOpacity>
                    </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.foldableFrame}>
            <Pressable style={styles.foldableHeader} onPress={() => {
              setTempRoomId(roomId);
              setTempApiKey(apiKey);
              setIsSettingsExpanded(!isSettingsExpanded);
            }}>
              <Text style={styles.headerText}>Settings</Text>
              <Icon name={isSettingsExpanded ? 'expand-less' : 'expand-more'} size={30} color="#00e5ff" />
            </Pressable>
            {isSettingsExpanded && (
              <View style={styles.foldableContent}>
                <Text style={styles.inputLabel}>Room ID</Text>
                <TextInput
                  style={styles.input}
                  value={tempRoomId}
                  onChangeText={setTempRoomId}
                  placeholder="e.g., 55T3E3HN"
                  placeholderTextColor="#666"
                  autoCapitalize="characters"
                />
                <Text style={styles.inputLabel}>API Key</Text>
                <TextInput
                  style={styles.input}
                  value={tempApiKey}
                  onChangeText={setTempApiKey}
                  placeholder="Your API Key"
                  placeholderTextColor="#666"
                  secureTextEntry
                />
                <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>
                  <Text style={styles.saveButtonText}>Save & Reconnect</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
        
        <View style={styles.actionsContainer}>
          <Pressable style={styles.actionsHeader} onPress={() => setIsActionsExpanded(!isActionsExpanded)}>
            <Text style={styles.actionsHeaderText}>Additional controls</Text>
            <Icon name={isActionsExpanded ? 'expand-more' : 'expand-less'} size={24} color="#888" />
          </Pressable>
          {isActionsExpanded && (
            <View style={styles.actionsContent}>
              <TouchableOpacity style={styles.extraBtn} onPress={handleReset}>
                <Icon name="refresh" size={24} color="#ccc" />
                <Text style={styles.extraBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.extraBtn} onPress={handleToggleMessage}>
                <Icon name="message" size={24} color="#ccc" />
                <Text style={styles.extraBtnText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.extraBtn, isFlashing && styles.extraBtnActive]} onPress={handleToggleFlash}>
                <Icon name="flash-on" size={24} color={isFlashing ? '#00e5ff' : '#ccc'} />
                <Text style={[styles.extraBtnText, isFlashing && styles.extraBtnTextActive]}>Flash</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.btn, styles.navBtn]} onPress={handlePrevious}><Icon name="skip-previous" size={40} color="#5bc0de" /></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, isRunning ? styles.pauseBtn : styles.playBtn]} onPress={handleStartPause}><Icon name={isRunning ? 'pause' : 'play-arrow'} size={50} color="#fff" /></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.navBtn]} onPress={handleNext}><Icon name="skip-next" size={40} color="#5bc0de" /></TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  viewerFrame: { height: 150, padding: 6, borderRadius: 18, borderWidth: 3, borderColor: '#00e5ff', backgroundColor: '#00181c', shadowColor: '#00e5ff', shadowOpacity: 0.8, shadowRadius: 12, elevation: 10, marginHorizontal: 10, marginTop: 10 },
  viewerInner: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  webview: { flex: 1 },
  middle: { flex: 1, paddingHorizontal: 10, paddingTop: 20 },
  foldableFrame: { marginBottom: 20, padding: 6, borderRadius: 18, borderWidth: 3, borderColor: '#00e5ff', backgroundColor: '#00181c', shadowColor: '#00e5ff', shadowOpacity: 0.8, shadowRadius: 12, elevation: 10 },
  foldableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
  headerText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  foldableContent: { paddingHorizontal: 10, paddingBottom: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: '#004a54' },
  timerItemWrapper: { borderBottomWidth: 1, borderBottomColor: '#003339' },
  timerItemContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  timerNameContainer: { flex: 1, marginRight: 10 },
  timerName: { color: '#eee', fontSize: 16 },
  activeTimerItem: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8 },
  activeTimerName: { color: '#00e5ff', fontWeight: 'bold' },
  selectedTimerItem: { borderColor: '#5bc0de', borderWidth: 2, borderRadius: 6, backgroundColor: 'rgba(91, 192, 222, 0.1)', paddingVertical: 8, paddingHorizontal: 8 },
  iconContainer: { flexDirection: 'row', alignItems: 'center' },
  loadingText: { color: '#888', paddingVertical: 12 },
  presetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#003339' },
  presetItemText: { color: '#eee', marginLeft: 10, fontSize: 16 },
  deleteItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#003339' },
  deleteItemText: { color: '#eee', marginLeft: 10, fontSize: 16 },
  actionsContainer: { paddingHorizontal: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#222' },
  actionsHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  actionsHeaderText: { color: '#888', fontSize: 14, marginRight: 4 },
  actionsContent: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#222' },
  extraBtn: { alignItems: 'center', padding: 8, borderRadius: 8, width: 80, marginHorizontal: 10 },
  extraBtnActive: { backgroundColor: 'rgba(0, 229, 255, 0.15)' },
  extraBtnText: { color: '#ccc', marginTop: 4, fontSize: 12 },
  extraBtnTextActive: { color: '#00e5ff' },
  adjustTimeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  adjustTimeLabel: { color: '#eee', fontSize: 16, textAlign: 'center' },
  adjustTimeButton: { backgroundColor: '#222', padding: 8, borderRadius: 20 },
  inputLabel: { color: '#ccc', fontSize: 14, marginTop: 10, marginBottom: 5 },
  input: { backgroundColor: '#000', color: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#333', paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  saveButton: { backgroundColor: '#00e5ff', borderRadius: 6, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#00181c', fontSize: 16, fontWeight: 'bold' },
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#000', paddingVertical: 16 },
  btn: { padding: 20, borderRadius: 50, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  pauseBtn: { backgroundColor: '#dc3545' },
  playBtn: { backgroundColor: '#28a745' },
  navBtn: { backgroundColor: '#222' },
});