# Simulação do ciclo mensal de Stars — 2026-09-18

> Gerado por `pnpm tsx scripts/report-monthly-cycle.ts`. **Nada foi escrito no banco.**
>
> Este arquivo é o registro do estado dos saldos **antes** da correção do vazamento V1
> (ciclo mensal que nunca rodou uma segunda vez). Se alguém questionar saldo depois de
> o cron ser ligado, é esta a prova de qual era a situação.

## A decisão que este relatório existe para embasar

O ciclo capa o saldo que passa adiante em `rolloverPct` da franquia do plano. Como o ciclo
nunca rodou, há organizações com saldo acumulado de vários meses — e elas **perderiam o
excedente** na primeira execução.

**Esse saldo foi acumulado porque o ciclo estava quebrado, não porque o cliente deixou de
usar.** Ligar o cron sem decidir o que fazer com ele transfere para o cliente o custo de um
bug nosso.

Opções:

- **a)** Ligar assim mesmo e comunicar aos clientes afetados.
- **b)** Creditar a diferença de volta com um ajuste manual registrado (`MANUAL_ADJUST`).
- **c)** Elevar `rolloverPct` apenas no primeiro ciclo corrigido, deixando todo o saldo passar.

Enquanto não houver decisão, o cron roda em **simulação** — exige `STARS_MONTHLY_CYCLE_CRON=true`
para aplicar.

## Resultado

```
Simulação do ciclo mensal — 2026-09-18

23 organização(ões) com ciclo vencido (mais de 30 dias).

ORGANIZAÇÃO                      PLANO            DIAS  SALDO HOJE  ROLLOVER    PERDE  SALDO DEPOIS
----------------------------------------------------------------------------------------------------
ACT Digital - Tráfego Pago       Constellation       —          99        99        0         20099
Armazém Carvalho                 Explore             —        2988       750     2238          3750
Arthur Laser                     Suite               —         100        30       70           130
Bondy Viagens                    Suite               —        1100        30     1070           130
CALT                             Suite               —         100        30       70           130
CRESCER VACINAS                  Constellation       —       14432      6000     8432         26000
ELIThe                           Constellation       —          97        97        0         20097
GUARACÍ                          Earth               —        2100       200     1900          1200
House Don                        Suite               —        1100        30     1070           130
JANE — Espaço                    Suite               —           0         0        0           100
Luban                            Earth               —        1100       200      900          1200
Mundo de Dentro                  Earth              94        1832       200     1632          1200
MUNDO DE DENTRO                  Earth              94        1200       200     1000          1200
NASA EX (TESTE)                  Suite               —           0         0        0           100
ORBITA HUB                       Constellation       —        7610      6000     1610         26000
Piauí Instituto de Tecnologia -  Constellation       —       10100      6000     4100         26000
PLENOCAR                         Constellation       —       19602      6000    13602         26000
PRINCIPIO ATIVO                  Suite               —         100        30       70           130
Ronaldo ltda                     Suite               —         100        30       70           130
Seu Canto Imóveis                Suite               —         100        30       70           130
SG ADVOCACIA                     Constellation       —         100       100        0         20100
TÉRCIO REZENDE                   Explore             —        4201       750     3451          3750
THAINE HARMONIZAÇÃO CORPORAL     Constellation       —         632       632        0         20632
----------------------------------------------------------------------------------------------------

Créditos de franquia a distribuir: 170900★
Saldo que seria perdido pelo teto: 41355★

⚠️  17 organização(ões) perderiam saldo acumulado:

    PLENOCAR                                   -13602★
    CRESCER VACINAS                            -8432★
    Piauí Instituto de Tecnologia - Startup    -4100★
    TÉRCIO REZENDE                             -3451★
    Armazém Carvalho                           -2238★
    GUARACÍ                                    -1900★
    Mundo de Dentro                            -1632★
    ORBITA HUB                                 -1610★
    Bondy Viagens                              -1070★
    House Don                                  -1070★
    MUNDO DE DENTRO                            -1000★
    Luban                                      -900★
    Arthur Laser                               -70★
    CALT                                       -70★
    PRINCIPIO ATIVO                            -70★
    Ronaldo ltda                               -70★
    Seu Canto Imóveis                          -70★

Esse saldo foi acumulado porque o ciclo nunca rodou — não porque o
cliente deixou de usar. Decida antes de ligar o cron:
  a) ligar assim mesmo e comunicar;
  b) creditar a diferença de volta com um ajuste manual registrado;
  c) elevar `rolloverPct` só no primeiro ciclo corrigido.

Nada foi escrito. Para aplicar, defina STARS_MONTHLY_CYCLE_CRON=true.
```
