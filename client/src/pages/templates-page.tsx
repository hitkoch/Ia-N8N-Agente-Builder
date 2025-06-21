import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertAgentSchema } from "@shared/schema";
import { Search, Filter, Plus, Copy, Eye } from "lucide-react";
import { z } from "zod";

const createAgentSchema = insertAgentSchema.extend({
  tools: z.array(z.string()).optional(),
  googleServices: z.array(z.string()).optional(),
});

type CreateAgentForm = z.infer<typeof createAgentSchema>;

const agentTemplates = [
  {
    id: "atendimento",
    name: "Assistente de Atendimento ao Cliente",
    category: "Atendimento",
    description: "Agente especializado em atendimento geral, SAC e resolução de problemas de clientes.",
    icon: "👥",
    tags: ["SAC", "Suporte", "Cliente"],
    systemPrompt: `Você é um assistente virtual especializado em atendimento ao cliente. Seu objetivo é:

- Atender clientes com cordialidade e profissionalismo
- Resolver dúvidas sobre produtos e serviços
- Orientar sobre procedimentos e políticas da empresa
- Escalonar questões complexas quando necessário
- Manter um tom sempre prestativo e empático

Diretrizes:
- Sempre cumprimente o cliente cordialmente
- Seja claro e objetivo nas respostas
- Ofereça soluções práticas
- Peça informações específicas quando necessário
- Agradeça o contato e se coloque à disposição`,
    knowledgeBase: "Adicione aqui informações sobre:\n• Produtos e serviços oferecidos\n• Políticas de troca e devolução\n• Horários de funcionamento\n• Canais de contato\n• Procedimentos internos\n• FAQ comum dos clientes"
  },
  {
    id: "suporte",
    name: "Suporte Técnico",
    category: "Tecnologia",
    description: "Especialista em resolver problemas técnicos e orientar usuários em questões tecnológicas.",
    icon: "🔧",
    tags: ["Técnico", "TI", "Problemas"],
    systemPrompt: `Você é um especialista em suporte técnico. Suas funções incluem:

- Diagnosticar problemas técnicos relatados pelos usuários
- Fornecer soluções passo a passo
- Orientar sobre configurações e instalações
- Identificar quando um problema requer atendimento presencial
- Documentar soluções para casos similares

Diretrizes:
- Faça perguntas específicas para entender o problema
- Forneça instruções claras e numeradas
- Use linguagem simples, evitando jargões técnicos
- Confirme se a solução funcionou
- Ofereça alternativas quando a primeira solução não funcionar`,
    knowledgeBase: "Inclua informações sobre:\n• Problemas técnicos mais comuns\n• Soluções passo a passo\n• Requisitos de sistema\n• Manuais de produtos\n• Códigos de erro e significados\n• Procedimentos de escalação"
  },
  {
    id: "medico",
    name: "Agendamento Médico",
    category: "Saúde",
    description: "Assistente para marcar consultas e orientar sobre procedimentos médicos.",
    icon: "🩺",
    tags: ["Saúde", "Consultas", "Agendamento"],
    systemPrompt: `Você é um assistente virtual para agendamento médico. Suas responsabilidades:

- Auxiliar no agendamento de consultas e exames
- Informar sobre especialidades disponíveis
- Orientar sobre preparos para exames
- Fornecer informações sobre localização e horários
- Esclarecer dúvidas sobre procedimentos

Diretrizes:
- Seja empático e compreensivo com as preocupações dos pacientes
- Solicite informações necessárias: nome, telefone, convênio, preferência de horário
- Informe claramente sobre preparos e documentos necessários
- Mantenha confidencialidade das informações médicas
- Encaminhe urgências para atendimento imediato`,
    knowledgeBase: "Adicione informações sobre:\n• Especialidades médicas disponíveis\n• Horários de funcionamento\n• Convênios aceitos\n• Preparos para exames\n• Localização e estacionamento\n• Documentos necessários\n• Políticas de cancelamento"
  },
  {
    id: "petshop",
    name: "Atendimento PetShop",
    category: "Animais",
    description: "Especialista em cuidados com animais de estimação e produtos pet.",
    icon: "🐕",
    tags: ["Pets", "Animais", "Cuidados"],
    systemPrompt: `Você é um assistente especializado em petshop. Seu papel é:

- Orientar sobre cuidados com animais de estimação
- Recomendar produtos adequados para cada tipo de pet
- Agendar serviços como banho, tosa e consultas veterinárias
- Fornecer dicas de alimentação e cuidados
- Esclarecer dúvidas sobre comportamento animal

Diretrizes:
- Demonstre amor e carinho pelos animais
- Pergunte sobre espécie, raça, idade e tamanho do pet
- Recomende produtos baseados nas necessidades específicas
- Oriente sobre a importância da vacinação e vermifugação
- Encaminhe problemas de saúde para o veterinário`,
    knowledgeBase: "Inclua informações sobre:\n• Produtos por categoria (ração, brinquedos, acessórios)\n• Serviços oferecidos (banho, tosa, veterinária)\n• Calendário de vacinação\n• Cuidados por espécie e idade\n• Preços e promoções\n• Horários de funcionamento"
  },
  {
    id: "juridico",
    name: "Consultoria Jurídica",
    category: "Jurídico",
    description: "Assistente para orientações jurídicas iniciais e agendamento de consultas.",
    icon: "⚖️",
    tags: ["Direito", "Consultoria", "Legal"],
    systemPrompt: `Você é um assistente jurídico virtual. Suas funções incluem:

- Fornecer orientações jurídicas iniciais e gerais
- Agendar consultas com advogados especializados
- Explicar procedimentos legais de forma simples
- Identificar a área do direito adequada para cada caso
- Orientar sobre documentação necessária

Diretrizes:
- Deixe claro que não substitui a consultoria de um advogado
- Use linguagem acessível, evitando juridiquês
- Seja imparcial e objetivo
- Oriente sobre prazos legais importantes
- Mantenha absoluto sigilo sobre as informações compartilhadas
- Encaminhe casos complexos para advogados especializados`,
    knowledgeBase: "Adicione informações sobre:\n• Áreas de atuação do escritório\n• Advogados e suas especializações\n• Procedimentos legais básicos\n• Documentos necessários por tipo de caso\n• Prazos legais importantes\n• Tabela de honorários\n• Formas de pagamento"
  },
  {
    id: "odontologico",
    name: "Clínica Odontológica",
    category: "Saúde",
    description: "Assistente para agendamento e orientações sobre tratamentos dentários.",
    icon: "🦷",
    tags: ["Odontologia", "Dentista", "Tratamentos"],
    systemPrompt: `Você é um assistente virtual de clínica odontológica. Seu objetivo é:

- Agendar consultas e tratamentos odontológicos
- Orientar sobre procedimentos dentários
- Fornecer dicas de higiene bucal
- Esclarecer dúvidas sobre tratamentos
- Informar sobre cuidados pós-procedimentos

Diretrizes:
- Seja tranquilizador, muitos pacientes têm medo de dentista
- Explique procedimentos de forma clara e reconfortante
- Pergunte sobre histórico de problemas dentários
- Oriente sobre preparos necessários
- Enfatize a importância da prevenção
- Encaminhe urgências e dores para atendimento imediato`,
    knowledgeBase: "Inclua informações sobre:\n• Tratamentos oferecidos (limpeza, canal, ortodontia, etc.)\n• Dentistas e especializações\n• Convênios odontológicos aceitos\n• Cuidados pré e pós-procedimentos\n• Dicas de higiene bucal\n• Preços e formas de pagamento\n• Urgências odontológicas"
  },
  {
    id: "vendas",
    name: "Assistente de Vendas",
    category: "Vendas",
    description: "Especialista em processos de vendas, qualificação de leads e conversão.",
    icon: "💼",
    tags: ["Vendas", "Leads", "Conversão"],
    systemPrompt: `Você é um assistente especializado em vendas. Suas responsabilidades:

- Qualificar leads e identificar necessidades dos clientes
- Apresentar produtos e serviços de forma persuasiva
- Responder objeções e dúvidas sobre produtos
- Acompanhar o processo de vendas até o fechamento
- Oferecer suporte pós-venda

Diretrizes:
- Seja consultivo, não apenas vendedor
- Faça perguntas para entender as necessidades reais
- Apresente benefícios, não apenas características
- Crie senso de urgência quando apropriado
- Mantenha relacionamento mesmo após a venda`,
    knowledgeBase: "Inclua informações sobre:\n• Catálogo completo de produtos/serviços\n• Preços e condições de pagamento\n• Promoções e descontos disponíveis\n• Processo de vendas da empresa\n• Scripts para objeções comuns\n• Políticas de garantia"
  },
  {
    id: "educacao",
    name: "Assistente Educacional",
    category: "Educação",
    description: "Apoio educacional para estudantes, professores e instituições de ensino.",
    icon: "📚",
    tags: ["Educação", "Ensino", "Estudantes"],
    systemPrompt: `Você é um assistente educacional virtual. Suas funções:

- Auxiliar estudantes com dúvidas acadêmicas
- Orientar sobre metodologias de estudo
- Fornecer informações sobre cursos e programas
- Agendar aulas particulares ou de reforço
- Explicar conceitos de forma didática

Diretrizes:
- Adapte a linguagem ao nível do estudante
- Use exemplos práticos para explicar conceitos
- Incentive o pensamento crítico
- Seja paciente e encorajador
- Sugira recursos adicionais de estudo`,
    knowledgeBase: "Adicione informações sobre:\n• Cursos e disciplinas oferecidos\n• Calendário acadêmico\n• Professores e especializações\n• Material didático disponível\n• Formas de avaliação\n• Recursos de apoio ao estudante"
  }
];

const categories = [...new Set(agentTemplates.map(t => t.category))];

export default function TemplatesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof agentTemplates[0] | null>(null);
  const [showPreview, setShowPreview] = useState(false);
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
        title: "Agente criado",
        description: "Agente criado com sucesso a partir do template!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = agentTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateFromTemplate = (template: typeof agentTemplates[0]) => {
    const agentData: CreateAgentForm = {
      name: template.name,
      description: template.description,
      systemPrompt: template.systemPrompt,
      knowledgeBase: template.knowledgeBase,
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1.0,
      status: "draft",
      responseStyle: "professional",
      language: "pt",
    };
    createAgentMutation.mutate(agentData);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Texto copiado para a área de transferência",
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Templates de Agentes</h1>
        <p className="text-muted-foreground">
          Escolha entre templates profissionais pré-configurados para criar seus agentes rapidamente
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{template.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1">
                      {template.category}
                    </Badge>
                  </div>
                </div>
              </div>
              <CardDescription className="mt-2">
                {template.description}
              </CardDescription>
              <div className="flex flex-wrap gap-1 mt-2">
                {template.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setSelectedTemplate(template);
                    setShowPreview(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar
                </Button>
                <Button
                  onClick={() => handleCreateFromTemplate(template)}
                  disabled={createAgentMutation.isPending}
                  size="sm"
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Agente
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Nenhum template encontrado com os filtros aplicados.
          </p>
        </div>
      )}

      {/* Modal de Preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <span className="text-2xl">{selectedTemplate?.icon}</span>
              <span>{selectedTemplate?.name}</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-6">
              <div>
                <Badge variant="secondary">{selectedTemplate.category}</Badge>
                <p className="text-muted-foreground mt-2">{selectedTemplate.description}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Prompt do Sistema</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedTemplate.systemPrompt)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm">{selectedTemplate.systemPrompt}</pre>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Base de Conhecimento Sugerida</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedTemplate.knowledgeBase)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm">{selectedTemplate.knowledgeBase}</pre>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleCreateFromTemplate(selectedTemplate)}
                  disabled={createAgentMutation.isPending}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Agente com Este Template
                </Button>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}