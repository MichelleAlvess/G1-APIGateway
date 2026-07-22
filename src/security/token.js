import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

export class TokenService {
  constructor(jwtConfig) {
    this.config = jwtConfig;
  }

  issueAccessToken(user) {
    const token = jwt.sign(
      {
        email: user.email,
        name: user.name,
        role: user.role
      },
      this.config.secret,
      {
        algorithm: 'HS256',
        subject: user.id,
        issuer: this.config.issuer,
        audience: this.config.audience,
        expiresIn: this.config.expiresIn,
        jwtid: randomUUID()
      }
    );

    const decoded = jwt.decode(token);

    return {
      token,
      expiresAt: new Date(decoded.exp * 1000).toISOString()
    };
  }

  verifyAccessToken(token) {
    return jwt.verify(token, this.config.secret, {
      algorithms: ['HS256'],
      issuer: this.config.issuer,
      audience: this.config.audience
    });
  }
}
