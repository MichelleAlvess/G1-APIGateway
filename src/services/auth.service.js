import { AppError } from '../errors/app-error.js';
import { verifyPassword } from '../security/password.js';

export class AuthService {
  constructor({ userRepository, tokenService, dummyPasswordHash }) {
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.dummyPasswordHash = dummyPasswordHash;
  }

  async login({ email, password }) {
    validateCredentials(email, password);

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    // Executa a derivação mesmo quando o usuário não existe, reduzindo diferenças
    // de tempo que poderiam facilitar a enumeração de e-mails.
    const hashToCheck = user?.passwordHash ?? this.dummyPasswordHash;
    const passwordMatches = await verifyPassword(password, hashToCheck);

    if (!user || !passwordMatches) {
      throw new AppError(
        401,
        'AUTH_INVALID_CREDENTIALS',
        'E-mail ou senha inválidos.'
      );
    }

    if (!user.active) {
      throw new AppError(403, 'AUTH_USER_DISABLED', 'Usuário desativado.');
    }

    const accessToken = this.tokenService.issueAccessToken(user);

    return {
      accessToken: accessToken.token,
      tokenType: 'Bearer',
      expiresAt: accessToken.expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  }
}

function validateCredentials(email, password) {
  const errors = [];

  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    errors.push({ field: 'email', message: 'Informe um e-mail válido.' });
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    errors.push({
      field: 'password',
      message: 'A senha deve possuir entre 8 e 128 caracteres.'
    });
  }

  if (errors.length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Dados de login inválidos.', errors);
  }
}
