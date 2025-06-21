import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertAgentSchema } from "@shared/schema";
import { 
  ChevronLeft, 
  ChevronRight, 
  Bot, 
  Brain, 
  Settings, 
  Zap, 
  FileText,
  Users,
  Globe,
  MessageSquare,
  CheckCircle,
  Sparkles,
  Target
} from "lucide-react";
import { z } from "zod";

const createAgentSchema = insertAgentSchema.extend({
  tools: z.array(z.string()).optional(),
  googleServices: z.array(z.string()).optional(),
});

type CreateAgentForm = z.infer<typeof createAgentSchema>;

interface AgentCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const WIZARD_STEPS = [
  {
    id: 1,
    title: "Objetivo e Propósito",
    icon: Target,
    description: "Defina o que seu agente deve fazer"
  },
  {
    id: 2,
    title: "Personalidade e Estilo",
    icon: Users,
    description: "Configure como seu agente se comporta"
  },
  {
    id: 3,
    title: "Conhecimento e Contexto",
    icon: Brain,
    description: "Adicione informações específicas"
  },
  {
    id: 4,
    title: "Configurações Técnicas",
    icon: Settings,
    description: "Ajuste parâmetros avançados"
  },
  {
    id: 5,
    title: "Revisão e Criação",
    icon: CheckCircle,
    description: "Confirme e crie seu agente"
  }
];

const AGENT_PURPOSES = [
  { id: "customer-service", name: "Atendimento ao Cliente", description: "Responder dúvidas e resolver problemas" },
  { id: "sales", name: "Vendas e Conversão", description: "Qualificar leads e fechar vendas" },
  { id: "support", name: "Suporte Técnico", description: "Resolver problemas técnicos" },
  { id: "education", name: "Educação e Treinamento", description: "Ensinar e orientar usuários" },
  { id: "healthcare", name: "Saúde e Bem-estar", description: "Orientações médicas e agendamentos" },
  { id: "legal", name: "Consultoria Jurídica", description: "Orientações legais iniciais" },
  { id: "finance", name: "Consultoria Financeira", description: "Orientações sobre finanças" },
  { id: "general", name: "Assistente Geral", description: "Múltiplas funções personalizadas" }
];

const PERSONALITY_STYLES = [
  { id: "professional", name: "Profissional", description: "Formal, preciso e objetivo" },
  { id: "friendly", name: "Amigável", description: "Caloroso, empático e acolhedor" },
  { id: "expert", name: "Especialista", description: "Técnico, detalhado e autoritativo" },
  { id: "casual", name: "Descontraído", description: "Informal, relaxado e conversacional" },
  { id: "enthusiastic", name: "Entusiasmado", description: "Energético, motivador e positivo" }
];

const COMMUNICATION_LANGUAGES = [
  { id: "pt", name: "Português (Brasil)" },
  { id: "en", name: "English" },
  { id: "es", name: "Español" },
  { id: "fr", name: "Français" }
];

export default function AgentCreationWizard({ isOpen, onClose }: AgentCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<CreateAgentForm>>({
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    status: "draft",
    language: "pt"
  });
  const [selectedPurpose, setSelectedPurpose] = useState<string>("");
  const [selectedPersonality, setSelectedPersonality] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createAgentMutation = useMutation({
    mutationFn: async (data: CreateAgentForm) => {
      const res = await apiRequest("POST", "/api/agents", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Agente criado com sucesso!",
        description: "Seu novo agente IA está pronto para uso.",
      });
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar agente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1.0,
      status: "draft",
      language: "pt"
    });
    setSelectedPurpose("");
    setSelectedPersonality("");
  };

  const nextStep = () => {
    if (currentStep < WIZARD_STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateSystemPrompt = () => {
    const purpose = AGENT_PURPOSES.find(p => p.id === selectedPurpose);
    const personality = PERSONALITY_STYLES.find(p => p.id === selectedPersonality);
    
    let prompt = `Você é um assistente de IA especializado em ${purpose?.name || 'assistência geral'}.

Seu objetivo principal é: ${purpose?.description || 'ajudar os usuários da melhor forma possível'}.

Estilo de comunicação: ${personality?.description || 'profissional e prestativo'}.

Diretrizes importantes:
- Sempre seja ${personality?.name?.toLowerCase() || 'profissional'} em suas respostas
- Mantenha o foco no seu objetivo principal
- Seja claro e objetivo
- Ofereça soluções práticas
- Peça esclarecimentos quando necessário`;

    if (formData.knowledgeBase) {
      prompt += `\n\nBase de conhecimento específica:\n${formData.knowledgeBase}`;
    }

    return prompt;
  };

  const handleSubmit = () => {
    const finalData: CreateAgentForm = {
      ...formData,
      systemPrompt: generateSystemPrompt(),
      responseStyle: selectedPersonality || 'professional',
    } as CreateAgentForm;

    createAgentMutation.mutate(finalData);
  };

  const progress = (currentStep / WIZARD_STEPS.length) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Target className="h-12 w-12 mx-auto mb-4" style={{ color: '#b8ec00' }} />
              <h3 className="text-xl font-bold mb-2" style={{ color: '#022b44' }}>
                Qual é o objetivo do seu agente?
              </h3>
              <p className="text-gray-600">
                Escolha a função principal que seu agente IA desempenhará
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                Nome do Agente
              </Label>
              <Input
                placeholder="Ex: Assistente de Vendas da Minha Empresa"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12"
              />
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                Descrição Resumida
              </Label>
              <Textarea
                placeholder="Descreva brevemente o que seu agente fará..."
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                Categoria de Uso
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AGENT_PURPOSES.map((purpose) => (
                  <Card
                    key={purpose.id}
                    className={`cursor-pointer transition-all ${
                      selectedPurpose === purpose.id
                        ? 'ring-2 shadow-lg'
                        : 'hover:shadow-md'
                    }`}
                    style={{
                      ringColor: selectedPurpose === purpose.id ? '#b8ec00' : 'transparent',
                      backgroundColor: selectedPurpose === purpose.id ? '#f0fdf4' : 'white'
                    }}
                    onClick={() => setSelectedPurpose(purpose.id)}
                  >
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-1" style={{ color: '#022b44' }}>
                        {purpose.name}
                      </h4>
                      <p className="text-sm text-gray-600">{purpose.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Users className="h-12 w-12 mx-auto mb-4" style={{ color: '#b8ec00' }} />
              <h3 className="text-xl font-bold mb-2" style={{ color: '#022b44' }}>
                Como seu agente deve se comunicar?
              </h3>
              <p className="text-gray-600">
                Defina a personalidade e o estilo de comunicação
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                Estilo de Personalidade
              </Label>
              <div className="grid grid-cols-1 gap-3">
                {PERSONALITY_STYLES.map((style) => (
                  <Card
                    key={style.id}
                    className={`cursor-pointer transition-all ${
                      selectedPersonality === style.id
                        ? 'ring-2 shadow-lg'
                        : 'hover:shadow-md'
                    }`}
                    style={{
                      ringColor: selectedPersonality === style.id ? '#b8ec00' : 'transparent',
                      backgroundColor: selectedPersonality === style.id ? '#f0fdf4' : 'white'
                    }}
                    onClick={() => setSelectedPersonality(style.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium mb-1" style={{ color: '#022b44' }}>
                            {style.name}
                          </h4>
                          <p className="text-sm text-gray-600">{style.description}</p>
                        </div>
                        {selectedPersonality === style.id && (
                          <CheckCircle className="h-5 w-5" style={{ color: '#b8ec00' }} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                Idioma Principal
              </Label>
              <Select
                value={formData.language || "pt"}
                onValueChange={(value) => setFormData({ ...formData, language: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione o idioma" />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.id} value={lang.id}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Brain className="h-12 w-12 mx-auto mb-4" style={{ color: '#b8ec00' }} />
              <h3 className="text-xl font-bold mb-2" style={{ color: '#022b44' }}>
                Conhecimento Específico
              </h3>
              <p className="text-gray-600">
                Adicione informações que seu agente deve conhecer
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                Base de Conhecimento
              </Label>
              <Textarea
                placeholder="Cole aqui informações sobre sua empresa, produtos, políticas, procedimentos, ou qualquer contexto específico que o agente deve conhecer..."
                value={formData.knowledgeBase || ""}
                onChange={(e) => setFormData({ ...formData, knowledgeBase: e.target.value })}
                rows={8}
                className="resize-none"
              />
              <p className="text-sm text-gray-500">
                Dica: Inclua informações sobre produtos, serviços, políticas, horários de funcionamento, 
                contatos importantes, ou qualquer informação específica do seu negócio.
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                Instruções Especiais (Opcional)
              </Label>
              <Textarea
                placeholder="Instruções específicas sobre como o agente deve se comportar em situações particulares..."
                value={formData.customInstructions || ""}
                onChange={(e) => setFormData({ ...formData, customInstructions: e.target.value })}
                rows={4}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Settings className="h-12 w-12 mx-auto mb-4" style={{ color: '#b8ec00' }} />
              <h3 className="text-xl font-bold mb-2" style={{ color: '#022b44' }}>
                Configurações Técnicas
              </h3>
              <p className="text-gray-600">
                Ajuste parâmetros avançados do seu agente
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                  Modelo de IA
                </Label>
                <Select
                  value={formData.model || "gpt-4o-mini"}
                  onValueChange={(value) => setFormData({ ...formData, model: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">GPT-4O Mini (Recomendado)</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4O (Mais Avançado)</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Mais Rápido)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                  Criatividade (Temperature)
                </Label>
                <Select
                  value={formData.temperature?.toString() || "0.7"}
                  onValueChange={(value) => setFormData({ ...formData, temperature: parseFloat(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.3">Conservador (0.3)</SelectItem>
                    <SelectItem value="0.7">Equilibrado (0.7)</SelectItem>
                    <SelectItem value="1.0">Criativo (1.0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                  Tamanho Máximo de Resposta
                </Label>
                <Select
                  value={formData.maxTokens?.toString() || "2048"}
                  onValueChange={(value) => setFormData({ ...formData, maxTokens: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1024">Curto (1024)</SelectItem>
                    <SelectItem value="2048">Médio (2048)</SelectItem>
                    <SelectItem value="4096">Longo (4096)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium" style={{ color: '#022b44' }}>
                  Status Inicial
                </Label>
                <Select
                  value={formData.status || "draft"}
                  onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="testing">Em Teste</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{ color: '#b8ec00' }} />
              <h3 className="text-xl font-bold mb-2" style={{ color: '#022b44' }}>
                Revisão Final
              </h3>
              <p className="text-gray-600">
                Confirme as configurações do seu agente antes de criar
              </p>
            </div>

            <Card className="bg-gray-50">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h4 className="font-medium mb-2" style={{ color: '#022b44' }}>Nome</h4>
                  <p className="text-gray-700">{formData.name}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2" style={{ color: '#022b44' }}>Descrição</h4>
                  <p className="text-gray-700">{formData.description}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2" style={{ color: '#022b44' }}>Categoria</h4>
                  <Badge style={{ backgroundColor: '#b8ec00', color: '#022b44' }}>
                    {AGENT_PURPOSES.find(p => p.id === selectedPurpose)?.name}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-medium mb-2" style={{ color: '#022b44' }}>Personalidade</h4>
                  <Badge variant="outline" style={{ borderColor: '#022b44', color: '#022b44' }}>
                    {PERSONALITY_STYLES.find(p => p.id === selectedPersonality)?.name}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-medium mb-2" style={{ color: '#022b44' }}>Modelo</h4>
                  <p className="text-gray-700">{formData.model}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2" style={{ color: '#022b44' }}>Preview do Prompt do Sistema</h4>
                  <div className="bg-white p-4 rounded border text-sm text-gray-700 max-h-32 overflow-y-auto">
                    {generateSystemPrompt()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.description && selectedPurpose;
      case 2:
        return selectedPersonality && formData.language;
      case 3:
        return true; // Optional step
      case 4:
        return formData.model && formData.temperature && formData.maxTokens;
      case 5:
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#f8fafc' }}>
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center space-x-3 text-2xl">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#022b44' }}>
              <Sparkles className="h-6 w-6" style={{ color: '#b8ec00' }} />
            </div>
            <span style={{ color: '#b8ec00' }}>Assistente de Criação de Agente</span>
          </DialogTitle>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: '#022b44' }}>
                Passo {currentStep} de {WIZARD_STEPS.length}
              </span>
              <span style={{ color: '#022b44' }}>
                {Math.round(progress)}% concluído
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Navigation */}
          <div className="flex items-center justify-center space-x-2 mt-4 flex-wrap">
            {WIZARD_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                      isActive ? 'shadow-md' : ''
                    }`}
                    style={{
                      backgroundColor: isActive ? '#b8ec00' : isCompleted ? '#e2e8f0' : '#f1f5f9',
                      color: isActive ? '#022b44' : isCompleted ? '#64748b' : '#94a3b8'
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium hidden sm:block">{step.title}</span>
                  </div>
                  {index < WIZARD_STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            style={{ borderColor: '#022b44', color: '#022b44' }}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          <div className="space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            
            {currentStep < WIZARD_STEPS.length ? (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                style={{ backgroundColor: '#022b44', color: '#FFFFFF' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#b8ec00';
                  e.currentTarget.style.color = '#022b44';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#022b44';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createAgentMutation.isPending || !canProceed()}
                style={{ backgroundColor: '#022b44', color: '#FFFFFF' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#b8ec00';
                  e.currentTarget.style.color = '#022b44';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#022b44';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
              >
                <Bot className="h-4 w-4 mr-2" />
                {createAgentMutation.isPending ? "Criando..." : "Criar Agente"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}