// Only operator-authored prose is translated. Secrets, shell commands and paths never pass through this table.
const DA: Readonly<Record<string, string>> = {
  'No backup configured.': 'Ingen sikkerhedskopi er konfigureret.',
  'Nothing is copied off this server. Set a backup up in Admin → Backups, then download':
    'Intet kopieres væk fra denne server. Opret en sikkerhedskopi under Administration → Sikkerhedskopier, og hent',
  'this kit again: it will hold the repository, its password and its credentials.':
    'derefter denne pakke igen. Den vil indeholde lageret, adgangskoden og adgangsoplysningerne.',
  'Download the kit again from Admin → Status, or run kept admin recovery-kit with the':
    'Hent pakken igen under Administration → Status, eller kør kept admin recovery-kit med',
  "database owner's login (KEPT_OWNER_DATABASE_URL), to include it.":
    'databaseejerens login (KEPT_OWNER_DATABASE_URL) for at medtage oplysningerne.',
  " (set by the server's environment)": ' (angivet i serverens miljø)',
  'The SFTP private key (save it as kept-backup-key, readable by you only):':
    'Den private SFTP-nøgle (gem den som kept-backup-key, så kun du kan læse den):',
  "The SFTP server's pinned host key (save this line as kept-known-hosts):":
    'SFTP-serverens fastlåste værtsnøgle (gem denne linje som kept-known-hosts):',
  'Read your inventory with restic alone (any computer with restic, no Tingfinder, no network for':
    'Læs din inventarliste med restic alene (enhver computer med restic, uden Tingfinder og uden netværk,',
  'a directory copied onto it):': 'hvis mappen er kopieret til computeren):',
  '  With a backup configured, this kit lists the commands with the repository filled in;':
    '  Når en sikkerhedskopi er konfigureret, viser pakken kommandoerne med lageret udfyldt.',
  '  see "Read your inventory with restic alone" in Tingfinder\'s documentation.':
    '  Se "Read your inventory with restic alone" i Tingfinders dokumentation.',
  '  (take the newest snapshot tagged nightly or manual; pre_upgrade ones hold no readable copy)':
    '  (vælg det nyeste øjebliksbillede mærket nightly eller manual; pre_upgrade har ingen læsbar kopi)',
  '  Then open kept-readable/backup/readable/index.html in a browser.':
    '  Åbn derefter kept-readable/backup/readable/index.html i en browser.',
  'To bring Tingfinder back on a new server ("Restore and the drill" in Tingfinder\'s documentation):':
    'Sådan gendannes Tingfinder på en ny server ("Restore and the drill" i Tingfinders dokumentation):',
  '  1. Install Tingfinder as the install guide says, but before its first start set':
    '  1. Installér Tingfinder som beskrevet i installationsvejledningen. Før første start skal',
  '     KEPT_SECRET_KEY and KEPT_AUTH_SECRET (and the version and retired keys, when listed)':
    '     KEPT_SECRET_KEY og KEPT_AUTH_SECRET (samt versionen og tidligere nøgler, hvis de er angivet)',
  '     to the values above. Without them, secret values and AI keys stay unreadable.':
    '     sættes til værdierne ovenfor. Uden dem kan hemmelige værdier og AI-nøgler ikke læses.',
  '  2. Set the backup target and its password to the values above.':
    '  2. Sæt sikkerhedskopiens destination og adgangskode til værdierne ovenfor.',
  '  2. Set the backup target and its password to the ones your backups were made with.':
    '  2. Angiv den destination og adgangskode, som dine sikkerhedskopier blev oprettet med.',
  '  3. Create an empty database and run kept admin restore <snapshot> into it; it checks':
    '  3. Opret en tom database, og kør kept admin restore <snapshot> til den. Kommandoen kontrollerer',
  '     every table by its data digest. Then swap it in as the guide says.':
    '     hver tabel ud fra dataenes kontrolsum. Skift derefter til databasen som beskrevet i vejledningen.',
  'TINGFINDER RECOVERY KIT': 'TINGFINDER GENDANNELSESPAKKE',
  'Keep this somewhere other than this server: a password manager, or printed. Anyone with it':
    'Gem denne pakke et andet sted end på serveren, f.eks. i en adgangskodeadministrator eller på papir. Enhver med pakken',
  'can read your backups and every secret value in them; without it, a restore brings back':
    'kan læse dine sikkerhedskopier og alle hemmelige værdier i dem. Uden pakken gendannes',
  'everything except secret values and AI keys.': 'alt undtagen hemmelige værdier og AI-nøgler.',
  '(no public address set)': '(ingen offentlig adresse angivet)',
  '== Keys ==': '== Nøgler ==',
  "the server's environment": 'serverens miljø',
  '(Retired keys open backups made before a rotation: keep them.)':
    '(Tidligere nøgler åbner sikkerhedskopier fra før et nøgleskift. Behold dem.)',
  '== Backup ==': '== Sikkerhedskopi ==',
  '== Restore ==': '== Gendannelse ==',
  'A new kit is needed after the backup settings change or the key is rotated; Admin → Status':
    'Du skal hente en ny pakke, når indstillingerne for sikkerhedskopiering ændres, eller nøglen udskiftes.',
  'says when.': 'Administration → Status viser, hvornår det er nødvendigt.',
  "the saved storage credentials couldn't be opened with this server's key.":
    'de gemte adgangsoplysninger til lageret kunne ikke åbnes med serverens nøgle.',
  "the SFTP key or known_hosts file the environment names couldn't be read.":
    'SFTP-nøglen eller known_hosts-filen, som miljøet angiver, kunne ikke læses.',
  "the database owner's login (KEPT_OWNER_DATABASE_URL) isn't set here.":
    'databaseejerens login (KEPT_OWNER_DATABASE_URL) er ikke angivet her.',
  "the database didn't answer when it was made.":
    'databasen svarede ikke, da pakken blev oprettet.',
  'Not included': 'Ikke medtaget',
  Target: 'Destination',
  Instance: 'Instans',
  Made: 'Oprettet',
  'Read from': 'Læst fra',
};

export function translateKit(text: string, danish: boolean): string {
  return danish ? (DA[text] ?? text) : text;
}
