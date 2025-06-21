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
import { Search, Filter, Plus, Copy, Eye, FileText } from "lucide-react";
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
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: '#022b44' }}>
            <FileText className="h-8 w-8" style={{ color: '#b8ec00' }} />
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#b8ec00' }}>
            Templates de Agentes IA
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Acelere seu desenvolvimento com templates profissionais pré-configurados. 
            Escolha, personalize e lance seu agente em minutos.
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold" style={{ color: '#022b44' }}>{agentTemplates.length}</div>
              <div className="text-sm text-muted-foreground">Templates Disponíveis</div>
            </CardContent>
          </Card>
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold" style={{ color: '#022b44' }}>{categories.length}</div>
              <div className="text-sm text-muted-foreground">Categorias</div>
            </CardContent>
          </Card>
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold" style={{ color: '#022b44' }}>100%</div>
              <div className="text-sm text-muted-foreground">Personalizáveis</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros Melhorados */}
        <Card className="mb-8 bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  placeholder="Buscar templates por nome, descrição ou tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 text-base bg-white/80 border-0 shadow-sm"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full lg:w-[200px] h-12 bg-white/80 border-0 shadow-sm">
                  <Filter className="h-5 w-5 mr-2" />
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🎯 Todas as categorias</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category === "Atendimento" && "👥"} 
                      {category === "Tecnologia" && "🔧"} 
                      {category === "Saúde" && "🩺"} 
                      {category === "Animais" && "🐕"} 
                      {category === "Jurídico" && "⚖️"} 
                      {category === "Vendas" && "💼"} 
                      {category === "Educação" && "📚"} 
                      {" " + category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Filtros Rápidos */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge 
                variant={selectedCategory === "all" ? "default" : "secondary"}
                className="cursor-pointer hover:scale-105 transition-transform"
                style={{ 
                  backgroundColor: selectedCategory === "all" ? '#022b44' : '#e2e8f0',
                  color: selectedCategory === "all" ? '#FFFFFF' : '#64748b'
                }}
                onClick={() => setSelectedCategory("all")}
              >
                Todos
              </Badge>
              {categories.slice(0, 4).map(category => (
                <Badge 
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className="cursor-pointer hover:scale-105 transition-transform"
                  style={{ 
                    backgroundColor: selectedCategory === category ? '#022b44' : 'transparent',
                    color: selectedCategory === category ? '#FFFFFF' : '#022b44',
                    borderColor: '#022b44'
                  }}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Grid de Templates */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredTemplates.map((template) => (
            <Card 
              key={template.id} 
              className="group hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm border-0 shadow-lg overflow-hidden"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="relative z-10 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#022b44' }}>
                        <span className="text-2xl" style={{ filter: 'hue-rotate(0deg) saturate(1) brightness(1)' }}>{template.icon}</span>
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold transition-colors" style={{ color: '#022b44' }}>
                          {template.name}
                        </CardTitle>
                        <Badge 
                          variant="secondary" 
                          className="mt-2 border-0"
                          style={{ backgroundColor: '#b8ec00', color: '#022b44' }}
                        >
                          {template.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="text-gray-600 leading-relaxed">
                    {template.description}
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {template.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs bg-white/50">
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs bg-white/50">
                        +{template.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="relative z-10 pt-0">
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowPreview(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 transition-colors"
                      style={{ borderColor: '#022b44', color: '#022b44' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#b8ec00';
                        e.currentTarget.style.borderColor = '#b8ec00';
                        e.currentTarget.style.color = '#022b44';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = '#022b44';
                        e.currentTarget.style.color = '#022b44';
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button
                      onClick={() => handleCreateFromTemplate(template)}
                      disabled={createAgentMutation.isPending}
                      size="sm"
                      className="flex-1 border-0 shadow-lg transition-colors"
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
                      <Plus className="h-4 w-4 mr-2" />
                      {createAgentMutation.isPending ? "Criando..." : "Usar Template"}
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="col-span-full">
            <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="text-center py-16">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Nenhum template encontrado</h3>
                <p className="text-muted-foreground mb-6">
                  Tente ajustar seus filtros ou termo de busca para encontrar o template ideal.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory("all");
                  }}
                >
                  Limpar Filtros
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal de Preview Melhorado */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-blue-50 to-purple-50">
          <DialogHeader className="pb-6">
            <DialogTitle className="flex items-center space-x-4 text-2xl">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#022b44' }}>
                <span className="text-2xl">{selectedTemplate?.icon}</span>
              </div>
              <div>
                <div className="font-bold" style={{ color: '#b8ec00' }}>
                  {selectedTemplate?.name}
                </div>
                <Badge variant="secondary" className="mt-1" style={{ backgroundColor: '#b8ec00', color: '#022b44' }}>
                  {selectedTemplate?.category}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-8">
              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-3" style={{ color: '#022b44' }}>Sobre este Template</h3>
                  <p className="text-gray-600 leading-relaxed mb-4">{selectedTemplate.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="bg-white/50">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg" style={{ color: '#022b44' }}>Prompt do Sistema</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedTemplate.systemPrompt)}
                      className="hover:bg-blue-100"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar
                    </Button>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                      {selectedTemplate.systemPrompt}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg" style={{ color: '#022b44' }}>Base de Conhecimento Sugerida</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(selectedTemplate.knowledgeBase)}
                      className="hover:bg-blue-100"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar
                    </Button>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-xl border">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                      {selectedTemplate.knowledgeBase}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  onClick={() => {
                    handleCreateFromTemplate(selectedTemplate);
                    setShowPreview(false);
                  }}
                  disabled={createAgentMutation.isPending}
                  className="flex-1 h-12 border-0 shadow-lg text-base transition-colors"
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
                  <Plus className="h-5 w-5 mr-2" />
                  {createAgentMutation.isPending ? "Criando Agente..." : "Criar Agente com Este Template"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowPreview(false)}
                  className="h-12 px-8 bg-white/70 hover:bg-white/90"
                >
                  Fechar Preview
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}