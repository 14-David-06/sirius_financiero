// Utilidades para prueba de grabación de audio
export const testAudioRecording = async () => {
  try {
    // Probar permisos de micrófono
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('✅ Permisos de micrófono concedidos');
    
    // Verificar que MediaRecorder esté disponible
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder no está disponible');
    }
    console.log('✅ MediaRecorder disponible');
    
    // Probar formatos soportados
    const formats = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ];
    
    const supportedFormats = formats.filter(format => 
      MediaRecorder.isTypeSupported(format)
    );
    
    console.log('📋 Formatos soportados:', supportedFormats);
    
    // Cerrar stream de prueba
    stream.getTracks().forEach(track => track.stop());
    
    return {
      success: true,
      supportedFormats,
      message: 'Audio recording test passed'
    };
    
  } catch (error) {
    console.error('❌ Error en test de grabación:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Audio recording test failed'
    };
  }
};

export const getAudioDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    console.log('🎤 Dispositivos de audio encontrados:', audioInputs.length);
    audioInputs.forEach((device, index) => {
      console.log(`  ${index + 1}. ${device.label || 'Micrófono sin nombre'}`);
    });
    
    return audioInputs;
  } catch (error) {
    console.error('Error obteniendo dispositivos:', error);
    return [];
  }
};