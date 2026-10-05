import type { AssessmentSkill, CefrLevel } from '../../types.js';
import type { PoolItem } from './pools-en.js';

/** FR pool v3 — independent situations; natural distractors / learner confusions. */
export const FR_POOLS: Record<AssessmentSkill, Partial<Record<CefrLevel, PoolItem[]>>> = {
  grammar: {
    A1: [
      {
        conceptKey: 'fr.a1.etre_nationalite',
        stem: 'Nous ____ français.',
        prompt: 'Choisissez la forme correcte.',
        options: ['sommes', 'êtes', 'suis', 'est'],
        correctIndex: 0,
        explanation: 'Nous → sommes.',
      },
      {
        conceptKey: 'fr.a1.articles',
        stem: 'Je bois ____ café le matin.',
        prompt: 'Choisissez la forme correcte.',
        options: ['du', 'de la', 'des', 'le'],
        correctIndex: 0,
        explanation: 'Du café (partitif masculin).',
      },
    ],
    A2: [
      {
        conceptKey: 'fr.a2.passe_compose',
        stem: 'Hier, nous ____ au cinéma.',
        prompt: 'Choisissez la forme correcte.',
        options: ['sommes allés', 'allons', 'allions', 'aller'],
        correctIndex: 0,
        explanation: 'Passé composé avec être.',
      },
      {
        conceptKey: 'fr.a2.futur_proche',
        stem: 'Je ____ lui parler demain.',
        prompt: 'Choisissez la forme correcte.',
        options: ['vais', 'suis', 'ai', 'fais'],
        correctIndex: 0,
        explanation: 'Futur proche: aller + infinitif.',
      },
    ],
    B1: [
      {
        conceptKey: 'fr.b1.imparfait',
        stem: 'Quand j’étais petit, je ____ souvent au parc.',
        prompt: 'Choisissez la forme correcte.',
        options: ['allais', 'suis allé', 'irai', 'vais'],
        correctIndex: 0,
        explanation: 'Habitude passée → imparfait.',
      },
      {
        conceptKey: 'fr.b1.relatives',
        stem: 'Voici le rapport ____ nous avons discuté hier en réunion.',
        prompt: 'Choisissez la forme correcte.',
        options: ['dont', 'que', 'qui', 'où'],
        correctIndex: 0,
        explanation: 'Discuter de → dont.',
      },
    ],
    B2: [
      {
        conceptKey: 'fr.b2.subjonctif',
        stem: 'Il faut que tu ____ plus tôt demain.',
        prompt: 'Choisissez la forme correcte.',
        options: ['partes', 'pars', 'partiras', 'parti'],
        correctIndex: 0,
        explanation: 'Il faut que + subjonctif.',
      },
      {
        conceptKey: 'fr.b2.plus_que_parfait',
        stem: 'Quand nous sommes arrivés, le train ____ déjà.',
        prompt: 'Choisissez la forme correcte.',
        options: ['était parti', 'est parti', 'partait', 'partira'],
        correctIndex: 0,
        explanation: 'Antériorité → plus-que-parfait.',
      },
    ],
    C1: [
      {
        conceptKey: 'fr.c1.concordance',
        stem:
          'Dans le compte rendu juridique, elle a affirmé qu’elle ____ déjà l’avenant avant la réunion de lundi.',
        prompt: 'Choisissez la forme correcte.',
        options: ['avait signé', 'a signé', 'signe', 'signera'],
        correctIndex: 0,
        explanation: 'Concordance : antériorité dans le passé.',
      },
      {
        conceptKey: 'fr.c1.conditionnel_passe',
        stem:
          'Sans l’erreur de calcul signalée hier, le budget ____ adopté dès la semaine dernière.',
        prompt: 'Choisissez la forme correcte.',
        options: ['aurait été', 'sera', 'est', 'aurait'],
        correctIndex: 0,
        explanation: 'Conditionnel passé irréel.',
      },
    ],
    C2: [
      {
        conceptKey: 'fr.c2.subjonctif_doute',
        stem:
          'Le comité doute que cette clause ____ suffisante pour couvrir les risques de non-livraison.',
        prompt: 'Choisissez la forme correcte.',
        options: ['soit', 'est', 'sera', 'était'],
        correctIndex: 0,
        explanation: 'Douter que + subjonctif.',
      },
      {
        conceptKey: 'fr.c2.gerondif',
        stem:
          '____ en compte les délais fournisseurs, l’équipe a reporté le lancement de deux semaines.',
        prompt: 'Choisissez la forme correcte.',
        options: ['En tenant', 'Tenant', 'Tenir', 'Ayant tient'],
        correctIndex: 0,
        explanation: 'Gérondif: en + participe présent.',
      },
    ],
  },
  vocabulary: {
    A1: [
      {
        conceptKey: 'fr.a1.vocab_petit_dejeuner',
        stem: 'Le matin, je prends un ____.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['petit-déjeuner', 'déjeuner', 'dîner', 'goûter'],
        correctIndex: 0,
        explanation: 'Repas du matin.',
      },
      {
        conceptKey: 'fr.a1.vocab_billet',
        stem: 'Il me faut un ____ pour le train.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['billet', 'reçu', 'menu', 'plan'],
        correctIndex: 0,
        explanation: 'Billet de transport.',
      },
    ],
    A2: [
      {
        conceptKey: 'fr.a2.vocab_rendez_vous',
        stem: 'J’ai un ____ chez le dentiste à 16 h.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['rendez-vous', 'réunion', 'invitation', 'visite'],
        correctIndex: 0,
        explanation: 'Rendez-vous médical.',
      },
      {
        conceptKey: 'fr.a2.vocab_retard',
        stem: 'Désolé pour le ____ ; le métro était bloqué.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['retard', 'retour', 'regard', 'refus'],
        correctIndex: 0,
        explanation: 'Retard = lateness.',
      },
    ],
    B1: [
      {
        conceptKey: 'fr.b1.vocab_echeance',
        stem: 'Merci d’envoyer le dossier avant l’____ de vendredi.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['échéance', 'échelle', 'échange', 'économie'],
        correctIndex: 0,
        explanation: 'Échéance = deadline.',
      },
      {
        conceptKey: 'fr.b1.colloc_prendre_decision',
        stem: 'Il faut ____ une décision aujourd’hui.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['prendre', 'faire', 'mettre', 'poser'],
        correctIndex: 0,
        explanation: 'Prendre une décision.',
      },
    ],
    B2: [
      {
        conceptKey: 'fr.b2.near_augmenter',
        stem: 'L’entreprise compte ____ les salaires l’an prochain.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['augmenter', 'agrandir', 'allonger', 'amplifier'],
        correctIndex: 0,
        explanation: 'Augmenter les salaires.',
      },
      {
        conceptKey: 'fr.b2.colloc_trafic_dense',
        stem: 'Il y avait un trafic ____ sur le périphérique.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['dense', 'fort', 'lourd', 'épais'],
        correctIndex: 0,
        explanation: 'Trafic dense.',
      },
    ],
    C1: [
      {
        conceptKey: 'fr.c1.near_attenuer',
        stem:
          'Dans la note aux investisseurs, les auteurs cherchent à ____ les inquiétudes sur les retards sans promettre de remboursement ni de nouveau calendrier.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['atténuer', 'amplifier', 'ignorer', 'célébrer'],
        correctIndex: 0,
        explanation: 'Atténuer = réduire la force des inquiétudes.',
      },
      {
        conceptKey: 'fr.c1.register_condescendant',
        stem:
          'Son ton restait poli, mais clairement ____ envers la proposition : il a remercié, puis est passé à autre chose sans en discuter le fond.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['condescendant', 'enthousiaste', 'curieux', 'reconnaissant'],
        correctIndex: 0,
        explanation: 'Condescendant = stance de superiorité polie.',
      },
    ],
    C2: [
      {
        conceptKey: 'fr.c2.stance_non_engagement',
        stem:
          'Sa conclusion remercie le jury pour « une piste intéressante » et suggère qu’elle « trouverait mieux sa place plus tard », sans proposer d’étape suivante. La posture est surtout ____ plutôt qu’un soutien.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['non engageante', 'enthousiaste', 'hostile', 'procédurale'],
        correctIndex: 0,
        explanation: 'Report poli sans engagement.',
      },
      {
        conceptKey: 'fr.c2.colloc_jeter_doute',
        stem:
          'Après la publication des nouveaux journaux d’expédition, plusieurs analystes ont dit que ces chiffres ____ le doute sur la prévision antérieure de déstockage en juin.',
        prompt: 'Choisissez le meilleur mot.',
        options: ['jetaient', 'mettaient', 'faisaient', 'portaient'],
        correctIndex: 0,
        explanation: 'Jeter le doute sur.',
      },
    ],
  },
  reading: {
    A1: [
      {
        conceptKey: 'fr.a1.read_horaires',
        stem: 'Panneau : « Fermé pour pause 13 h–14 h. » Quand peut-on entrer ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Avant 13 h ou après 14 h',
          'Seulement à 13 h',
          'Toute l’après-midi sans pause',
          'Jamais aujourd’hui',
        ],
        correctIndex: 0,
        explanation: 'Fermé seulement pendant la pause.',
      },
      {
        conceptKey: 'fr.a1.read_bus',
        stem: 'Tableau : « Bus 12 → Gare. » Où va le bus 12 ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: ['À la gare', 'Vers le bus 12 seulement', 'Partout en ville', 'Nulle part'],
        correctIndex: 0,
        explanation: 'La flèche indique la destination.',
      },
    ],
    A2: [
      {
        conceptKey: 'fr.a2.read_wifi',
        stem: 'Carte : « Wi‑Fi Invité / mot de passe sur le ticket. » Où est le mot de passe ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: ['Sur le ticket', 'Sur l’invité', 'Seulement sur le routeur', 'Indisponible'],
        correctIndex: 0,
        explanation: 'Mot de passe sur le ticket.',
      },
      {
        conceptKey: 'fr.a2.read_file',
        stem: 'Affiche : « Prenez un numéro et attendez. » Que faire d’abord ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Prendre un numéro',
          'Attendre sans numéro',
          'Partir tout de suite',
          'Appeler un responsable',
        ],
        correctIndex: 0,
        explanation: 'Prendre un numéro d’abord.',
      },
    ],
    B1: [
      {
        conceptKey: 'fr.b1.read_remboursement',
        stem: 'Règle : « Les billets non utilisés sont remboursables sous 48 h après l’achat. » Quand ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Dans les deux jours suivant l’achat, s’ils sont inutilisés',
          'À tout moment après l’événement',
          'Seulement avant l’achat',
          'Jamais pour les billets inutilisés',
        ],
        correctIndex: 0,
        explanation: '48 h + inutilisé.',
      },
      {
        conceptKey: 'fr.b1.read_echange_shifts',
        stem: 'Message : « Tu peux prendre mon jeudi si je prends ton lundi ? » Que propose-t-on ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Un échange de créneaux',
          'Un jour de congé pour les deux',
          'Une démission',
          'Une baisse de salaire',
        ],
        correctIndex: 0,
        explanation: 'Échange de shifts.',
      },
    ],
    B2: [
      {
        conceptKey: 'fr.b2.read_prevision_prudente',
        stem: 'Note : « La croissance est probable, même si les risques d’approvisionnement restent réels. » Quelle posture ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Optimiste mais prudente',
          'Effondrement certain',
          'Aucune opinion',
          'Célébration pure',
        ],
        correctIndex: 0,
        explanation: 'Probable + même si = optimisme mesuré.',
      },
      {
        conceptKey: 'fr.b2.read_refus_doux',
        stem: 'Courriel : « Nous admirons le concept ; le calendrier pose problème. » Qu’est-ce qui est implicite ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Un non provisoire',
          'Une approbation immédiate',
          'Une demande de paiement',
          'Des éloges sans réserve',
        ],
        correctIndex: 0,
        explanation: 'Obstacle de calendrier = report/refus.',
      },
    ],
    C1: [
      {
        conceptKey: 'fr.c1.read_critique_sous_estimee',
        stem:
          'Note de relecture : « Le texte est bien ordonné et la prose maîtrisée. Pourtant, l’affirmation centrale s’appuie sur une prémisse que les auteurs laissent largement inexplorée, ce qui affaiblit la portée des recommandations. » Quelle est la critique principale ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Le fondement de l’affirmation est insuffisamment examiné',
          'La rédaction est désordonnée',
          'Il n’y a aucun argument',
          'La prémisse est déjà démontrée',
        ],
        correctIndex: 0,
        explanation: 'Prémisse inexplorée = critique de fond.',
      },
      {
        conceptKey: 'fr.c1.read_relation_discours',
        stem:
          'Note trimestrielle : « Les coûts unitaires ont encore baissé au T2 après le changement de fournisseur. Néanmoins, le gel des embauches est resté en place, et plusieurs équipes signalent une tension de capacité. » Que marque « Néanmoins » ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Un contraste / une suite inattendue',
          'La cause du gel des embauches',
          'Une définition du T2',
          'Une liste de synonymes',
        ],
        correctIndex: 0,
        explanation: 'Néanmoins = contraste.',
      },
    ],
    C2: [
      {
        conceptKey: 'fr.c2.read_implicature',
        stem:
          'Procès-verbal : « Les membres ont remercié les auteurs pour la diffusion du projet. Le comité a pris note de la proposition avec intérêt, puis est passé sans délai aux autres points sans demander de suite ni de vote. » Quelle lecture pragmatique est la plus probable ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Non-engagement poli plutôt qu’approbation',
          'Approbation unanime du financement',
          'Demande de mise en œuvre immédiate',
          'Erreur de secrétariat',
        ],
        correctIndex: 0,
        explanation: 'Pris note + pas de suite ≈ mise de côté.',
      },
      {
        conceptKey: 'fr.c2.read_ambiguite',
        stem:
          'Clause : « Les participants peuvent se retirer après notification, laquelle doit être écrite et remise au secrétariat au moins dix jours avant la date d’effet. » Qu’est-ce qui doit être écrit ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'La notification',
          'Le retrait seulement après l’événement',
          'Les participants eux-mêmes',
          'Rien de particulier',
        ],
        correctIndex: 0,
        explanation: 'Laquelle se rattache à notification.',
      },
    ],
  },
  functional: {
    A1: [
      {
        conceptKey: 'fr.a1.func_prix',
        stem: 'Dans un magasin, vous voulez le prix. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: ['C’est combien ?', 'C’est comment ?', 'C’est quand ?', 'Où sont les toilettes ?'],
        correctIndex: 0,
        explanation: 'Demande de prix.',
      },
      {
        conceptKey: 'fr.a1.func_merci',
        stem: 'On vous tient la porte. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: ['Merci.', 'Pardon.', 'Bonjour.', 'De rien.'],
        correctIndex: 0,
        explanation: 'Remerciement.',
      },
    ],
    A2: [
      {
        conceptKey: 'fr.a2.func_repeter',
        stem: 'Vous n’avez pas bien entendu une adresse. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Vous pouvez répéter, s’il vous plaît ?',
          'Vous pouvez parler plus bas, s’il vous plaît ?',
          'Où est la gare la plus proche ?',
          'Combien ça coûte ?',
        ],
        correctIndex: 0,
        explanation: 'Demande de répétition.',
      },
      {
        conceptKey: 'fr.a2.func_proposer_heure',
        stem: 'Vous voulez proposer 18 h. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'On se retrouve à 18 h ?',
          'On s’est vus à 18 h hier.',
          'Désolé, je suis occupé maintenant.',
          'Combien coûte le billet ?',
        ],
        correctIndex: 0,
        explanation: 'Proposition de rendez-vous.',
      },
    ],
    B1: [
      {
        conceptKey: 'fr.b1.func_refus_doux',
        stem: 'On vous invite ce soir ; vous avez déjà un engagement. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Avec plaisir, mais j’ai déjà quelque chose.',
          'Oui, je peux venir à tout moment.',
          'Pourquoi me demandez-vous ça ?',
          'Envoyez-moi la facture, s’il vous plaît.',
        ],
        correctIndex: 0,
        explanation: 'Refus poli avec raison.',
      },
      {
        conceptKey: 'fr.b1.func_confirmer',
        stem: 'Vous voulez confirmer que vendredi reste l’échéance. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Juste pour confirmer : vendredi reste la date limite ?',
          'Annulez tout le projet aujourd’hui.',
          'Je vais ignorer l’échéance pour l’instant.',
          'Pouvez-vous me prêter votre ordinateur ?',
        ],
        correctIndex: 0,
        explanation: 'Confirmation polie.',
      },
    ],
    B2: [
      {
        conceptKey: 'fr.b2.func_desaccord',
        stem: 'En réunion, vous n’êtes pas tout à fait d’accord sur l’évaluation des risques. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Je vois votre point, même si j’évaluerais les risques autrement.',
          'Vous avez complètement tort sur tout.',
          'Je suis d’accord sur chaque détail sans réserve.',
          'Parlons plutôt du déjeuner.',
        ],
        correctIndex: 0,
        explanation: 'Désaccord mesuré.',
      },
      {
        conceptKey: 'fr.b2.func_prolongation',
        stem: 'Vous avez besoin de deux jours de plus pour un rapport. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Serait-il possible de prolonger l’échéance de deux jours ?',
          'J’abandonne le projet immédiatement.',
          'Supprimez le rapport du lecteur partagé.',
          'L’échéance n’a jamais eu d’importance.',
        ],
        correctIndex: 0,
        explanation: 'Demande polie de prolongation.',
      },
    ],
    C1: [
      {
        conceptKey: 'fr.c1.func_pushback',
        stem:
          'Un client impose une date de lancement agressive qui forcerait des raccourcis risqués. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'On peut viser cette date si le périmètre est réduit ; sinon la qualité en pâtirait.',
          'Cette date convient ; nous ignorerons les tests.',
          'Nous refusons parce que vous avez toujours tort.',
          'Décidez seul et envoyez-nous le résultat.',
        ],
        correctIndex: 0,
        explanation: 'Résistance diplomatique conditionnelle.',
      },
      {
        conceptKey: 'fr.c1.func_desescalade',
        stem:
          'Une discussion de planification devient tendue et peu productive. Que dites-vous pour la recentrer ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Peut-être mettons de côté les points litigieux et listons ce sur quoi nous sommes déjà d’accord.',
          'Arrêtez de parler ; j’ai déjà décidé pour tout le monde.',
          'Ignorons le désaccord et faisons comme s’il n’existait pas.',
          'Une discussion tendue signifie que la réunion doit s’arrêter sans notes.',
        ],
        correctIndex: 0,
        explanation: 'Désescalade et structure.',
      },
    ],
    C2: [
      {
        conceptKey: 'fr.c2.func_declin_indirect',
        stem:
          'Vous voulez décliner une proposition sans refus brutal, en préservant la relation. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Cette direction est intéressante ; elle trouverait peut-être mieux sa place plus tard.',
          'Non, et ne nous contactez plus à ce sujet.',
          'L’idée ne vaut rien et doit être abandonnée aujourd’hui.',
          'Nous approuvons la proposition en entier avec un financement immédiat.',
        ],
        correctIndex: 0,
        explanation: 'Report indirect.',
      },
      {
        conceptKey: 'fr.c2.func_alignement_partiel',
        stem:
          'Vous voulez montrer un alignement partiel avec une stratégie sans donner un plein soutien. Que dites-vous ?',
        prompt: 'Choisissez la meilleure réponse.',
        options: [
          'Je suis sensible à l’objectif, sous réserve d’indicateurs de succès plus clairs.',
          'J’approuve chaque détail sans aucune condition.',
          'Je rejette l’objectif mais je loue les indicateurs.',
          'Cette sympathie vaut un engagement juridique signé.',
        ],
        correctIndex: 0,
        explanation: 'Alignement conditionnel.',
      },
    ],
  },
};
