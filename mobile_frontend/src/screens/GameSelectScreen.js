import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { WS_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function GameSelectScreen({ navigation, route }) {
  const { username } = route.params;
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('Connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'game-created') {
          navigation.navigate('Lobby', {
            username,
            gameCode: data.gameCode,
          });
        }

        if (data.type === 'game-joined') {
          navigation.navigate('Lobby', {
            username,
            gameCode: data.gameCode,
          });
        }

        if (data.type === 'join-error') {
          setError(data.message);
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('Error');
    };

    ws.onclose = () => {
      setConnectionStatus('Disconnected');
    };

    return () => {
      ws.close();
    };
  }, [username, navigation]);

  const handleCreateGame = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'create-game' }));
    }
  };

  const handleJoinGame = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && joinCode.trim()) {
      setError('');
      wsRef.current.send(JSON.stringify({
        type: 'join-game',
        gameCode: joinCode.trim().toUpperCase(),
      }));
    }
  };

  const isConnected = connectionStatus === 'Connected';

  const handleTopRightButton = () => {
    AsyncStorage.removeItem('username');
    navigation.navigate('Username', { username: username });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableOpacity
        style={styles.topRightButton}
        onPress={handleTopRightButton}
      >
        <Text style={styles.topRightButtonText}>Change username</Text>
      </TouchableOpacity>

      <Text style={styles.status}>
        Status: <Text style={isConnected ? styles.connected : styles.disconnected}>
          {connectionStatus}
        </Text>
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create new game</Text>
        <TouchableOpacity
          style={[styles.createButton, !isConnected && styles.buttonDisabled]}
          onPress={handleCreateGame}
          disabled={!isConnected}
        >
          <Text style={styles.createButtonText}>Create game</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.divider}>or</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Join game</Text>
        <View style={styles.joinContainer}>
          <TextInput
            style={styles.codeInput}
            value={joinCode}
            onChangeText={(text) => setJoinCode(text.toUpperCase())}
            placeholder="KOODI"
            placeholderTextColor="#555"
            maxLength={4}
            autoCapitalize="characters"
            editable={isConnected}
          />
          <TouchableOpacity
            style={[styles.joinButton, (!isConnected || !joinCode.trim()) && styles.buttonDisabled]}
            onPress={handleJoinGame}
            disabled={!isConnected || !joinCode.trim()}
          >
            <Text style={styles.joinButtonText}>Join</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
    justifyContent: 'center',
  },
  status: {
    textAlign: 'center',
    color: '#888',
    marginBottom: 40,
    fontSize: 16,
  },
  connected: {
    color: '#4caf50',
  },
  disconnected: {
    color: '#f44336',
  },
  section: {
    alignItems: 'center',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#888',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#ff8c42',
    paddingVertical: 18,
    paddingHorizontal: 50,
    borderRadius: 12,
    shadowColor: '#ff8c42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  divider: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginVertical: 20,
  },
  joinContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  codeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 140, 66, 0.3)',
    borderRadius: 10,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff8c42',
    textAlign: 'center',
    letterSpacing: 8,
    width: 160,
  },
  joinButton: {
    backgroundColor: '#ff8c42',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 10,
    justifyContent: 'center',
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  error: {
    color: '#f44336',
    marginTop: 12,
    fontSize: 14,
  },
  topRightButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#ff8c42',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#ff8c42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  topRightButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
