# Sai Agora

Diz-lhe **a que minuto sair de casa** para apanhar o autocarro da Carris Metropolitana sem esperar na paragem.

## Como funciona
- Guarda trajetos (casa → paragem → linhas).
- Soma o tempo a pé até à paragem + 1 min de margem e compara com a passagem do autocarro **em tempo real**.
- Avisa no telemóvel quando é hora de sair (notificação local, reagendada se o autocarro se atrasar).
- 🎲 **Ecrã simples**: uma mensagem gigante ("SAIA DAQUI A 5 MIN") para quem prefere o mínimo.

## Caminhos com transbordos (Transitous)
- Viagens porta-a-porta (a pé + autocarro + metro + comboio + barco) vêm da API comunitária **Transitous** (MOTIS 2): `https://api.transitous.org/api/v1/plan`.
- **Condições:** projeto open-source (licença MIT neste repositório — publique o código, ex.: GitHub), **não comercial**, uso leve (cache 60 s, atualização a cada 2 min). Atribuição visível: link para https://transitous.org/sources/ e © OpenStreetMap.
- Quando houver muitos utilizadores ou se quiser monetizar: instalar um servidor MOTIS próprio com os GTFS abertos (Metro, Carris, Carris Metropolitana, CP…) e trocar `TRANSITOUS_BASE` em `src/data/transit.ts`.
- A Carris (Lisboa) não dá tempo real a terceiros: os autocarros dela aparecem com horário previsto. Carris Metropolitana: tempo real completado pela API dela.
- Mapa: web → MapLibre + OpenFreeMap (sem chave); telemóvel → react-native-maps (Apple Maps; Google Maps no Android precisa de chave em produção).

## Dados (sem autorização necessária)
- API pública da Carris Metropolitana: `https://api.carrismetropolitana.pt/v2` — `/stops`, `/arrivals/by_stop/:id`.
- Dados da rede com licença **CC BY 4.0** → é obrigatório indicar "Dados: Carris Metropolitana" (já está na app).
- Sem ligação à API, a app usa horários de EXEMPLO e diz isso no ecrã.

## Correr
```bash
npm install
npx expo start        # Expo Go no telemóvel: GPS, notificações e dados reais funcionam
bash scripts/build-web.sh   # preview web (dados de exemplo)
```

## Estrutura
- `App.tsx` — estado, relógio (1 s), atualização dos horários (30 s), notificações, armazenamento local
- `src/data/carris.ts` — API + dados de exemplo + distâncias
- `src/lib/plan.ts` — escolhe o autocarro que ainda dá para apanhar e calcula a hora de saída
- `src/screens/` — Setup (3 passos), Home (cartões por trajeto), Simple (ecrã gigante)

## Design
Claro, letra grande (texto base 17, contagem 56), botões ≥ 48–56 px, estado sempre escrito ("Tem tempo", "Prepare-se", "Saia já!"), não só por cor. Movimento mínimo; tudo desliga com "reduzir movimento".

## Próximos passos
- Tempo a pé real com rotas pedonais (agora é estimativa em linha reta × 1,3).
- Widget no ecrã principal (iOS/Android).
- Avisar familiar quando o autocarro foi apanhado (precisa de servidor).
