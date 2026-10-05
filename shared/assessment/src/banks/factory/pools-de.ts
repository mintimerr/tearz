import type { AssessmentSkill, CefrLevel } from '../../types.js';
import type { PoolItem } from './pools-en.js';

/** DE pool v3 — independent; natural learner-error distractors (case/agreement/word order). */
export const DE_POOLS: Record<AssessmentSkill, Partial<Record<CefrLevel, PoolItem[]>>> = {
  grammar: {
    A1: [
      {
        conceptKey: 'de.a1.sein',
        stem: 'Wir ____ aus Berlin.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['sind', 'bist', 'bin', 'ist'],
        correctIndex: 0,
        explanation: 'Wir → sind.',
      },
      {
        conceptKey: 'de.a1.artikel',
        stem: 'Das ist ____ Apfel.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['ein', 'eine', 'einen', 'der'],
        correctIndex: 0,
        explanation: 'Nominativ maskulin: ein.',
      },
    ],
    A2: [
      {
        conceptKey: 'de.a2.perfekt',
        stem: 'Gestern ____ wir ins Museum gegangen.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['sind', 'haben', 'seid', 'habt'],
        correctIndex: 0,
        explanation: 'Bewegungsverben mit sein.',
      },
      {
        conceptKey: 'de.a2.akkusativ',
        stem: 'Ich sehe ____ Mann.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['den', 'der', 'dem', 'des'],
        correctIndex: 0,
        explanation: 'Akkusativ maskulin: den.',
      },
    ],
    B1: [
      {
        conceptKey: 'de.b1.weil_verbend',
        stem: 'Ich bleibe zu Hause, weil ich krank ____.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['bin', 'ich bin', 'sein', 'bist'],
        correctIndex: 0,
        explanation: 'Nebensatz: Verb am Ende.',
      },
      {
        conceptKey: 'de.b1.relativ',
        stem: 'Das ist der Kollege, ____ gestern angerufen hat.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['der', 'den', 'dem', 'dessen'],
        correctIndex: 0,
        explanation: 'Relativpronomen Nominativ: der.',
      },
    ],
    B2: [
      {
        conceptKey: 'de.b2.konjunktiv_ii',
        stem: 'Wenn ich mehr Zeit hätte, ____ ich länger bleiben.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['würde', 'werde', 'wurde', 'will'],
        correctIndex: 0,
        explanation: 'Konjunktiv II: würde.',
      },
      {
        conceptKey: 'de.b2.plusquamperfekt',
        stem: 'Als wir ankamen, ____ der Zug schon abgefahren.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['war', 'ist', 'hatte', 'wurde'],
        correctIndex: 0,
        explanation: 'Vorzeitigkeit mit sein → Plusquamperfekt.',
      },
    ],
    C1: [
      {
        conceptKey: 'de.c1.nominalstil',
        stem:
          'Im juristischen Vermerk heißt es, die Freigabe ____ erst nach schriftlicher Zustimmung der Rechtsabteilung erfolgen.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['dürfe', 'darf', 'durfte', 'dürfen hat'],
        correctIndex: 0,
        explanation: 'Indirekte Rede / Konjunktiv I: dürfe.',
      },
      {
        conceptKey: 'de.c1.partizipial',
        stem:
          '____ die Lieferverzögerungen, verschob das Team den Launch um zwei Wochen.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['Angesichts', 'Wegenem', 'Trotzdem von', 'Während'],
        correctIndex: 0,
        explanation: 'Angesichts + Genitiv.',
      },
    ],
    C2: [
      {
        conceptKey: 'de.c2.irrealis',
        stem:
          'Ohne den gestern gemeldeten Rechenfehler ____ der Haushalt bereits in der Vorwoche verabschiedet worden.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['wäre', 'wird', 'ist', 'wurde'],
        correctIndex: 0,
        explanation: 'Irrealer Konditionalis der Vergangenheit.',
      },
      {
        conceptKey: 'de.c2.praeposition_nuance',
        stem:
          'Die Änderung ist ____ der schriftlichen Freigabe durch Legal abhängig, bevor sie wirksam wird.',
        prompt: 'Wählen Sie die richtige Form.',
        options: ['von', 'zu', 'für', 'mit'],
        correctIndex: 0,
        explanation: 'Abhängig von.',
      },
    ],
  },
  vocabulary: {
    A1: [
      {
        conceptKey: 'de.a1.vocab_fruehstueck',
        stem: 'Morgens esse ich oft ____.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['Frühstück', 'Mittagessen', 'Abendessen', 'Snack'],
        correctIndex: 0,
        explanation: 'Mahlzeit am Morgen.',
      },
      {
        conceptKey: 'de.a1.vocab_fahrkarte',
        stem: 'Für den Zug brauche ich eine ____.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['Fahrkarte', 'Quittung', 'Speisekarte', 'Kartei'],
        correctIndex: 0,
        explanation: 'Fahrkarte = ticket.',
      },
    ],
    A2: [
      {
        conceptKey: 'de.a2.vocab_termin',
        stem: 'Ich habe um 16 Uhr einen Zahnarzt____.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['Termin', 'Treffen', 'Besuch', 'Einladung'],
        correctIndex: 0,
        explanation: 'Termin = appointment.',
      },
      {
        conceptKey: 'de.a2.vocab_verspaetung',
        stem: 'Entschuldigung für die ____; die Bahn hatte Störung.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['Verspätung', 'Verzögerung', 'Versprechen', 'Verpackung'],
        correctIndex: 0,
        explanation: 'Verspätung = lateness.',
      },
    ],
    B1: [
      {
        conceptKey: 'de.b1.vocab_frist',
        stem: 'Bitte senden Sie das Formular vor der ____ am Freitag.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['Frist', 'Überschrift', 'Zeitlinie', 'Skizze'],
        correctIndex: 0,
        explanation: 'Frist = deadline.',
      },
      {
        conceptKey: 'de.b1.colloc_entscheidung',
        stem: 'Wir müssen heute eine Entscheidung ____.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['treffen', 'machen', 'tun', 'stellen'],
        correctIndex: 0,
        explanation: 'Eine Entscheidung treffen.',
      },
    ],
    B2: [
      {
        conceptKey: 'de.b2.near_erhoehen',
        stem: 'Das Unternehmen will die Gehälter ____.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['erhöhen', 'erholen', 'erheben', 'erhöht'],
        correctIndex: 0,
        explanation: 'Erhöhen = raise (transitive).',
      },
      {
        conceptKey: 'de.b2.colloc_starker_verkehr',
        stem: 'Auf dem Ring herrschte ____ Verkehr.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['starker', 'stark', 'starke', 'stärksten'],
        correctIndex: 0,
        explanation: 'Starker Verkehr (Nom. mask. Adj.).',
      },
    ],
    C1: [
      {
        conceptKey: 'de.c1.near_abmildern',
        stem:
          'Im Risiko-Memo an Investoren versuchen die Autoren, Restbedenken zu ____, ohne Erstattung oder einen neuen Zeitplan zuzusagen.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['abmildern', 'verstärken', 'ignorieren', 'feiern'],
        correctIndex: 0,
        explanation: 'Abmildern = reduce force of concerns.',
      },
      {
        conceptKey: 'de.c1.register_herablassend',
        stem:
          'Sein Ton blieb höflich, wirkte aber klar ____ gegenüber dem Vorschlag: Er dankte und wechselte das Thema, ohne auf die Sache einzugehen.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['herablassend', 'begeistert', 'neugierig', 'dankbar'],
        correctIndex: 0,
        explanation: 'Herablassend = dismissive superior stance.',
      },
    ],
    C2: [
      {
        conceptKey: 'de.c2.stance_unverbindlich',
        stem:
          'Ihr Schlusssatz dankte dem Gremium für eine „interessante Richtung“ und meinte, sie „passe besser in eine spätere Phase“, ohne nächsten Schritt. Die Haltung ist eher ____ als Zustimmung.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['unverbindlich', 'begeistert', 'feindselig', 'rein formal'],
        correctIndex: 0,
        explanation: 'Höfliche Nicht-Festlegung.',
      },
      {
        conceptKey: 'de.c2.colloc_zweifeln',
        stem:
          'Nach den neuen Versandprotokollen sagten mehrere Analysten, die Zahlen ____ Zweifel an der früheren Prognose, dass Bestände bis Juni abgebaut wären.',
        prompt: 'Wählen Sie das beste Wort.',
        options: ['wecken', 'werfen', 'machen', 'legen'],
        correctIndex: 0,
        explanation: 'Zweifel wecken.',
      },
    ],
  },
  reading: {
    A1: [
      {
        conceptKey: 'de.a1.read_pause',
        stem: 'Schild: „Mittagspause 13:00–14:00 geschlossen.“ Wann können Sie einkaufen?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Vor 13:00 oder nach 14:00',
          'Nur um 13:00',
          'Den ganzen Nachmittag ohne Pause',
          'Heute gar nicht',
        ],
        correctIndex: 0,
        explanation: 'Nur in der Pause geschlossen.',
      },
      {
        conceptKey: 'de.a1.read_bus',
        stem: 'Tafel: „Bus 12 → Bahnhof.“ Wohin fährt Bus 12?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: ['Zum Bahnhof', 'Nur zu Bus 12', 'Durch die ganze Stadt', 'Nirgendwohin'],
        correctIndex: 0,
        explanation: 'Pfeil zeigt Ziel.',
      },
    ],
    A2: [
      {
        conceptKey: 'de.a2.read_wlan',
        stem: 'Karte: „WLAN Gast / Passwort auf dem Beleg.“ Wo ist das Passwort?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: ['Auf dem Beleg', 'Auf dem Gast', 'Nur am Router', 'Nicht verfügbar'],
        correctIndex: 0,
        explanation: 'Passwort auf dem Beleg.',
      },
      {
        conceptKey: 'de.a2.read_nummer',
        stem: 'Aushang: „Nummer ziehen und warten.“ Was zuerst?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: ['Eine Nummer ziehen', 'Ohne Nummer warten', 'Sofort gehen', 'Den Chef anrufen'],
        correctIndex: 0,
        explanation: 'Zuerst Nummer ziehen.',
      },
    ],
    B1: [
      {
        conceptKey: 'de.b1.read_erstattung',
        stem: 'Regel: „Unbenutzte Tickets sind innerhalb von 48 Stunden nach Kauf erstattbar.“ Wann?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Innerhalb von zwei Tagen nach Kauf, wenn unbenutzt',
          'Jederzeit nach der Veranstaltung',
          'Nur vor dem Kauf',
          'Nie bei unbenutzten Tickets',
        ],
        correctIndex: 0,
        explanation: '48 Stunden + unbenutzt.',
      },
      {
        conceptKey: 'de.b1.read_schichttausch',
        stem: 'Chat: „Kannst du meinen Donnerstag übernehmen, wenn ich deinen Montag nehme?“ Was wird angeboten?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: ['Ein Schichttausch', 'Ein freier Tag für beide', 'Eine Kündigung', 'Eine Gehaltskürzung'],
        correctIndex: 0,
        explanation: 'Tausch der Schichten.',
      },
    ],
    B2: [
      {
        conceptKey: 'de.b2.read_vorsichtige_prognose',
        stem: 'Kurzbriefing: „Wachstum ist wahrscheinlich, auch wenn Lieferrisiken spürbar bleiben.“ Welche Haltung?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: ['Optimistisch, aber abgesichert', 'Sicherer Zusammenbruch', 'Keine Meinung', 'Reine Feier'],
        correctIndex: 0,
        explanation: 'Wahrscheinlich + auch wenn = hedged.',
      },
      {
        conceptKey: 'de.b2.read_weiche_absage',
        stem: 'Mail: „Wir schätzen das Konzept; der Zeitpunkt ist das Hindernis.“ Was ist impliziert?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Eine vorläufige Absage',
          'Sofortige Zustimmung',
          'Eine Zahlungsaufforderung',
          'Lob ohne Vorbehalt',
        ],
        correctIndex: 0,
        explanation: 'Zeitpunkt = Aufschub/Absage.',
      },
    ],
    C1: [
      {
        conceptKey: 'de.c1.read_untertriebene_kritik',
        stem:
          'Peer-Review: „Der Text ist sorgfältig gegliedert und die Prosa kontrolliert. Dennoch stützt sich die zentrale Behauptung auf eine Prämisse, die die Autoren weitgehend ungeprüft lassen, was die späteren Empfehlungen schwächt.“ Was ist die Hauptkritik?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Die Grundlage der Behauptung wird unzureichend geprüft',
          'Die Sprache ist unordentlich',
          'Es gibt kein Argument',
          'Die Prämisse ist bereits bewiesen',
        ],
        correctIndex: 0,
        explanation: 'Ungeprüfte Prämisse = inhaltliche Kritik.',
      },
      {
        conceptKey: 'de.c1.read_diskursrelation',
        stem:
          'Quartalsnotiz: „Die Stückkosten sanken im Q2 nach dem Lieferantenwechsel erneut. Gleichwohl blieb der Einstellungsstopp bestehen, und mehrere Teams meldeten Kapazitätsengpässe.“ Was markiert „Gleichwohl“?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Kontrast / unerwartete Fortsetzung',
          'Ursache des Einstellungsstopps',
          'Definition von Q2',
          'Eine Synonymliste',
        ],
        correctIndex: 0,
        explanation: 'Gleichwohl = Kontrast.',
      },
    ],
    C2: [
      {
        conceptKey: 'de.c2.read_implikatur',
        stem:
          'Protokoll: „Die Mitglieder dankten den Autoren für die Vorlage. Der Ausschuss nahm den Vorschlag mit Interesse zur Kenntnis und ging ohne Nachforderung und ohne Abstimmung zügig zu anderen Punkten über.“ Welche pragmatische Lesart ist am wahrscheinlichsten?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Höfliche Nichtfestlegung statt Zustimmung',
          'Einstimmige Mittelbewilligung',
          'Bitte um sofortige Umsetzung',
          'Ein Protokollfehler',
        ],
        correctIndex: 0,
        explanation: 'Zur Kenntnis + kein Follow-up ≈ Beiseitelegen.',
      },
      {
        conceptKey: 'de.c2.read_ambiguitaet',
        stem:
          'Klausel: „Teilnehmende können nach Mitteilung zurücktreten, die schriftlich und mindestens zehn Tage vor dem Wirksamkeitsdatum beim Sekretariat eingehen muss.“ Was muss schriftlich sein?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Die Mitteilung',
          'Der Rücktritt erst nach der Veranstaltung',
          'Die Teilnehmenden selbst',
          'Nichts Bestimmtes',
        ],
        correctIndex: 0,
        explanation: 'Relativsatz bezieht sich auf Mitteilung.',
      },
    ],
  },
  functional: {
    A1: [
      {
        conceptKey: 'de.a1.func_preis',
        stem: 'Im Laden möchten Sie den Preis wissen. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: ['Was kostet das?', 'Wie viele ist das?', 'Wie spät ist das?', 'Wo ist die Toilette?'],
        correctIndex: 0,
        explanation: 'Preisfrage.',
      },
      {
        conceptKey: 'de.a1.func_danke',
        stem: 'Jemand hält Ihnen die Tür auf. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: ['Danke.', 'Entschuldigung.', 'Guten Morgen.', 'Bitte schön.'],
        correctIndex: 0,
        explanation: 'Dank ist angemessen.',
      },
    ],
    A2: [
      {
        conceptKey: 'de.a2.func_wiederholen',
        stem: 'Sie haben eine Adresse nicht klar gehört. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Könnten Sie das bitte wiederholen?',
          'Könnten Sie bitte leiser sprechen?',
          'Wo ist der nächste Bahnhof?',
          'Was kostet das Ticket?',
        ],
        correctIndex: 0,
        explanation: 'Höfliche Bitte um Wiederholung.',
      },
      {
        conceptKey: 'de.a2.func_uhrzeit_vorschlagen',
        stem: 'Sie möchten um 18 Uhr vorschlagen. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Treffen wir uns um 18 Uhr?',
          'Wir haben uns gestern um 18 Uhr getroffen.',
          'Tut mir leid, ich bin gerade beschäftigt.',
          'Was kostet die Fahrkarte?',
        ],
        correctIndex: 0,
        explanation: 'Terminvorschlag.',
      },
    ],
    B1: [
      {
        conceptKey: 'de.b1.func_absage',
        stem: 'Eine Kollegin lädt Sie für heute Abend ein; Sie haben schon Pläne. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Gerne, aber ich habe schon etwas vor.',
          'Ja, ich kann jederzeit kommen.',
          'Warum fragen Sie mich das?',
          'Schicken Sie mir bitte die Rechnung.',
        ],
        correctIndex: 0,
        explanation: 'Höfliche Absage mit Grund.',
      },
      {
        conceptKey: 'de.b1.func_frist_klaeren',
        stem: 'Sie wollen klären, ob Freitag noch die Frist ist. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Nur zur Sicherheit — ist Freitag noch die Deadline?',
          'Bitte streichen Sie das ganze Projekt heute.',
          'Ich ignoriere die Frist vorerst.',
          'Können Sie mir Ihren Laptop leihen?',
        ],
        correctIndex: 0,
        explanation: 'Höfliche Bestätigung.',
      },
    ],
    B2: [
      {
        conceptKey: 'de.b2.func_widerspruch',
        stem: 'In einem Meeting widersprechen Sie teilweise einer Risikoeinschätzung. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Ich verstehe Ihren Punkt, würde die Risiken aber anders gewichten.',
          'Sie liegen in allen Punkten völlig falsch.',
          'Ich stimme jedem Detail vorbehaltlos zu.',
          'Sprechen wir lieber über das Mittagessen.',
        ],
        correctIndex: 0,
        explanation: 'Abgeschwächter Widerspruch.',
      },
      {
        conceptKey: 'de.b2.func_verlaengerung',
        stem: 'Sie brauchen zwei Tage mehr für einen Bericht. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Wäre es möglich, die Frist um zwei Tage zu verlängern?',
          'Ich steige sofort aus dem Projekt aus.',
          'Bitte löschen Sie den Bericht vom Laufwerk.',
          'Die Frist war nie wichtig.',
        ],
        correctIndex: 0,
        explanation: 'Höfliche Verlängerungsbitte.',
      },
    ],
    C1: [
      {
        conceptKey: 'de.c1.func_pushback',
        stem:
          'Ein Kunde drängt auf ein aggressives Launch-Datum, das unsichere Abkürzungen erzwingen würde. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Wir können dieses Datum anstreben, wenn der Umfang reduziert wird; sonst leidet die Qualität.',
          'Das Datum ist in Ordnung; wir lassen Tests weg.',
          'Wir lehnen ab, weil Sie immer Unrecht haben.',
          'Entscheiden Sie allein und mailen Sie uns das Ergebnis.',
        ],
        correctIndex: 0,
        explanation: 'Diplomatischer, konditionaler Widerspruch.',
      },
      {
        conceptKey: 'de.c1.func_deeskalation',
        stem:
          'Eine Planungsdiskussion wird hitzig und unproduktiv. Was sagen Sie, um sie zu strukturieren?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Vielleicht stellen wir strittige Punkte zurück und listen zuerst, worin wir schon einig sind.',
          'Hören Sie auf zu reden; ich habe schon für alle entschieden.',
          'Wir sollten Uneinigkeit ignorieren und so tun, als gäbe es sie nicht.',
          'Hitzige Rede bedeutet, dass das Meeting ohne Notizen endet.',
        ],
        correctIndex: 0,
        explanation: 'Deeskalation und Struktur.',
      },
    ],
    C2: [
      {
        conceptKey: 'de.c2.func_indirekte_absage',
        stem:
          'Sie wollen einen Vorschlag ohne harte Absage zurückstellen und die Beziehung wahren. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Die Richtung ist interessant; sie passt vielleicht besser in eine spätere Phase.',
          'Nein, und kontaktieren Sie uns dazu nicht erneut.',
          'Die Idee ist wertlos und sollte heute aufgegeben werden.',
          'Wir genehmigen den Vorschlag vollständig mit sofortiger Finanzierung.',
        ],
        correctIndex: 0,
        explanation: 'Indirekte Verschiebung.',
      },
      {
        conceptKey: 'de.c2.func_teilweise_passung',
        stem:
          'Sie wollen teilweise Übereinstimmung zeigen, ohne volle Zustimmung zu geben. Was sagen Sie?',
        prompt: 'Wählen Sie die beste Antwort.',
        options: [
          'Dem Ziel stehe ich aufgeschlossen gegenüber, sofern klarere Erfolgsmetriken vorliegen.',
          'Ich genehmige jedes Detail ohne jede Bedingung.',
          'Ich lehne das Ziel ab, lobe aber die Metriken laut.',
          'Diese Aufgeschlossenheit gilt als unterschriebene Rechtsverpflichtung.',
        ],
        correctIndex: 0,
        explanation: 'Bedingte / teilweise Zustimmung.',
      },
    ],
  },
};
