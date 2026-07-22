export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  login = async (req, res) => {
    const result = await this.authService.login(req.body ?? {});
    res.status(200).json(result);
  };

  validate = async (req, res) => {
    res.status(200).json({
      valid: true,
      user: req.auth
    });
  };
}
