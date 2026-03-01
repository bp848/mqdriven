export const normalizeFormCode=(raw:string):string|null=>{
  const m:Record<string,string>={
    EXPENSE:'EXP',TRANSPORT:'TRP',TRAVEL:'TRP',
    LEAVE:'LEV',APPROVAL:'APL',DAILY:'DLY',
    EXP:'EXP',TRP:'TRP',LEV:'LEV',APL:'APL',DLY:'DLY'
  };
  const k=(raw||'').toUpperCase().trim();return m[k]??null;
};
