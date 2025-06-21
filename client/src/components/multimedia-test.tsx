import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mic, Image, Play, Square, Upload, Volume2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface MultimediaTestProps {
  agentId: number;
}

export function MultimediaTest({ agentId }: MultimediaTestProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string>("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Gravação iniciada",
        description: "Fale agora e clique em parar quando terminar"
      });
    } catch (error) {
      toast({
        title: "Erro na gravação",
        description: "Não foi possível acessar o microfone",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      toast({
        title: "Gravação finalizada",
        description: "Áudio pronto para envio"
      });
    }
  };

  const processAudio = async () => {
    if (!audioBlob) return;
    
    setIsProcessing(true);
    setResult("");
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('voice_response', voiceEnabled.toString());
      
      const response = await apiRequest(`/api/agents/${agentId}/multimedia/audio`, {
        method: 'POST',
        body: formData
      });
      
      setResult(response.response);
      
      if (response.audioResponse && voiceEnabled) {
        // Play voice response
        const audioResponse = new Audio(`data:audio/mp3;base64,${response.audioResponse}`);
        audioResponse.play();
      }
      
      toast({
        title: "Áudio processado",
        description: "Resposta gerada com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro no processamento",
        description: "Falha ao processar áudio",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setResult("");
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('voice_response', voiceEnabled.toString());
      
      const response = await apiRequest(`/api/agents/${agentId}/multimedia/image`, {
        method: 'POST',
        body: formData
      });
      
      setResult(response.response);
      
      if (response.audioResponse && voiceEnabled) {
        const audioResponse = new Audio(`data:audio/mp3;base64,${response.audioResponse}`);
        audioResponse.play();
      }
      
      toast({
        title: "Imagem analisada",
        description: "Análise concluída com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro na análise",
        description: "Falha ao analisar imagem",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        processImage(file);
      } else {
        toast({
          title: "Arquivo não suportado",
          description: "Apenas imagens são suportadas via upload",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Teste de Voz
          </CardTitle>
          <CardDescription>
            Grave um áudio para testar transcrição e resposta por voz
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              disabled={isProcessing}
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Parar Gravação
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Iniciar Gravação
                </>
              )}
            </Button>
            
            {audioUrl && (
              <Button variant="outline" onClick={() => new Audio(audioUrl).play()}>
                <Play className="h-4 w-4 mr-2" />
                Reproduzir
              </Button>
            )}
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="voice-response"
                checked={voiceEnabled}
                onChange={(e) => setVoiceEnabled(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="voice-response" className="flex items-center gap-1">
                <Volume2 className="h-4 w-4" />
                Resposta por voz
              </Label>
            </div>
          </div>
          
          {audioBlob && (
            <Button
              onClick={processAudio}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? "Processando..." : "Enviar Áudio para Agente"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Teste de Imagem
          </CardTitle>
          <CardDescription>
            Envie uma imagem para análise visual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Selecionar Imagem
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resposta do Agente</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={result}
              readOnly
              className="min-h-[100px]"
              placeholder="A resposta do agente aparecerá aqui..."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}