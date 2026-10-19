const access = require('../auth/access');
const gifts = [
 {number:1,day:4,title:'Auditoría MEG',url:'https://auditoriameg.netlify.app/',key:'COSTOSYPRECIOS'},
 {number:2,day:7,title:'Estado de resultados económico',url:'https://estado-de-resultados-economico.netlify.app/',key:'ECONOMICO'},
 {number:3,day:9,title:'Cashflow proyectado',url:'https://cashflow-proyectado.netlify.app/',key:'CASHFLOW'}
];
module.exports = (req,res) => {
 if(!req.authUser)return res.status(401).json({message:'Sesión requerida'});
 if(!access.canAccessPageForUser(req.authUser,'entrenamiento.html'))return res.status(403).json({message:'Sin acceso a capacitación'});
 res.set('Cache-Control','no-store').json({gifts,uses:7});
};
